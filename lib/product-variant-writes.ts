import 'server-only';

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { planVariantChanges } from '@/lib/variant-plan';
import { getStoreOptionGroupsByIds } from '@/queries/get-option-groups';
import { getProduct } from '@/queries/get-product';

type VariantPlan = Extract<ReturnType<typeof planVariantChanges>, { isValid: true }>;

type PrepareOptions = {
  storeId: string;
  // Omitted for a product that doesn't exist yet
  productId?: string;
  body: unknown;
};

type PrepareResult = { isValid: true; groupIds: string[]; plan: VariantPlan } | { isValid: false; message: string };

type SaveOptions = {
  storeId: string;
  productId: string;
  groupIds: string[];
  plan: VariantPlan;
};

const INVALID_VARIANTS_MESSAGE = 'Neteisingi variantų duomenys';
const DUPLICATE_GROUP_MESSAGE = 'Ta pati savybė pasirinkta kelis kartus';
const GROUP_NOT_FOUND_MESSAGE = 'Savybė šioje parduotuvėje nerasta';
export const VARIANT_HAS_ORDERS_MESSAGE = 'Variantas turi užsakymų, todėl jo ištrinti negalima. Bandykite dar kartą.';
// Prisma's emulated Restrict (relationMode = "prisma") when an order item still references a deleted variant
const RELATION_VIOLATION_ERROR_CODE = 'P2014';

const variantEditorInputSchema = z.object({
  optionGroupIds: z.array(z.string().min(1)),
  variants: z.array(
    z.object({
      id: z.string().min(1).optional(),
      optionValueIds: z.array(z.string().min(1)),
      sku: z.string().nullable(),
      stockCount: z.number(),
      price: z.number().finite().nullable(),
      salePrice: z.number().finite().nullable(),
    }),
  ),
});

// Reads the submitted groups and variant table, checks them against the store's groups and the product's
// existing variants, and returns the planned writes for saveProductVariants.
export const prepareVariantChanges = async ({ storeId, productId, body }: PrepareOptions): Promise<PrepareResult> => {
  const parsed = variantEditorInputSchema.safeParse(body);

  if (!parsed.success) {
    return { isValid: false, message: INVALID_VARIANTS_MESSAGE };
  }

  const { optionGroupIds, variants } = parsed.data;

  if (new Set(optionGroupIds).size !== optionGroupIds.length) {
    return { isValid: false, message: DUPLICATE_GROUP_MESSAGE };
  }

  const storeGroups = await getStoreOptionGroupsByIds(storeId, optionGroupIds);
  const groups = optionGroupIds.flatMap((groupId) => {
    const group = storeGroups.find(({ id }) => id === groupId);

    return group ? [{ id: group.id, valueIds: group.values.map((value) => value.id) }] : [];
  });

  if (groups.length !== optionGroupIds.length) {
    return { isValid: false, message: GROUP_NOT_FOUND_MESSAGE };
  }

  const product = productId ? await getProduct(storeId, productId, { includePlanVariants: true }) : null;
  const existingVariants = (product?.variants ?? []).map(({ _count, ...variant }) => ({
    ...variant,
    hasOrders: _count.orderItems > 0,
  }));

  const plan = planVariantChanges({ groups, existingVariants, variants });

  if (!plan.isValid) {
    return plan;
  }

  return { isValid: true, groupIds: optionGroupIds, plan };
};

// The only place variant rows (and so variant prices) are written, so price history can be added here later.
export const saveProductVariants = async (
  tx: Prisma.TransactionClient,
  { storeId, productId, groupIds, plan }: SaveOptions,
): Promise<void> => {
  const updateIds = plan.updates.map(({ id }) => id);
  const createdVariants = plan.creates.map((variant) => ({ ...variant, id: crypto.randomUUID() }));

  await tx.productVariant.deleteMany({ where: { productId, id: { in: plan.deleteIds } } });
  // Archived variants give up their SKU so it can be reused; order items keep their own SKU snapshot
  await tx.productVariant.updateMany({
    where: { productId, id: { in: plan.archiveIds } },
    data: { isArchived: true, sku: null },
  });
  // Clears SKUs first so two variants can swap SKUs without tripping the per-store unique index
  await tx.productVariant.updateMany({ where: { productId, id: { in: updateIds } }, data: { sku: null } });

  for (const { id, sku, stockCount, price, salePrice } of plan.updates) {
    await tx.productVariant.update({ where: { id }, data: { sku, stockCount, price, salePrice, isArchived: false } });
  }

  await tx.productVariant.createMany({
    data: createdVariants.map(({ id, combinationKey, sku, stockCount, price, salePrice }) => ({
      id,
      storeId,
      productId,
      combinationKey,
      sku,
      stockCount,
      price,
      salePrice,
    })),
  });
  await tx.productVariantOptionValue.createMany({
    data: createdVariants.flatMap(({ id, optionValueIds }) =>
      optionValueIds.map((optionValueId) => ({ variantId: id, optionValueId })),
    ),
  });

  await tx.productOptionGroup.deleteMany({ where: { productId } });
  await tx.productOptionGroup.createMany({
    data: groupIds.map((groupId, position) => ({ productId, groupId, position })),
  });
};

// Prisma's emulated Restrict fired: a variant planned for deletion got order items after it was checked
export const isVariantWithOrdersError = (error: unknown): boolean => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === RELATION_VIOLATION_ERROR_CODE;
};
