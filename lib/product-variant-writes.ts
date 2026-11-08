import 'server-only';

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ProductGroupWrites, resolveProductGroups } from '@/lib/product-groups';
import { planVariantChanges } from '@/lib/variant-plan';
import { getProductOwnedOptionGroups, getStoreOptionGroupsByIds } from '@/queries/get-option-groups';
import { getProduct } from '@/queries/get-product';

type VariantPlan = Extract<ReturnType<typeof planVariantChanges>, { isValid: true }>;

type PrepareOptions = {
  storeId: string;
  // Omitted for a product that doesn't exist yet
  productId?: string;
  body: unknown;
};

type PrepareResult =
  | { isValid: true; groupIds: string[]; plan: VariantPlan; productGroupWrites: ProductGroupWrites }
  | { isValid: false; message: string };

type SaveOptions = {
  storeId: string;
  productId: string;
  groupIds: string[];
  plan: VariantPlan;
  productGroupWrites: ProductGroupWrites;
};

const INVALID_VARIANTS_MESSAGE = 'Neteisingi variantų duomenys';
export const VARIANT_HAS_ORDERS_MESSAGE = 'Variantas turi užsakymų, todėl jo ištrinti negalima. Bandykite dar kartą.';
// Prisma's emulated Restrict (relationMode = "prisma") when an order item still references a deleted variant
const RELATION_VIOLATION_ERROR_CODE = 'P2014';

const variantEditorInputSchema = z.object({
  optionGroupIds: z.array(z.string().min(1)),
  // Product groups the product uses, with the values it uses; new ones carry temporary ids from the form
  productGroups: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string(),
        values: z.array(z.object({ id: z.string().min(1), label: z.string() })),
      }),
    )
    .default([]),
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

// Reads the submitted groups and variant table, checks them against the store's groups, the product's own
// groups and its existing variants, and returns the planned writes for saveProductVariants.
export const prepareVariantChanges = async ({ storeId, productId, body }: PrepareOptions): Promise<PrepareResult> => {
  const parsed = variantEditorInputSchema.safeParse(body);

  if (!parsed.success) {
    return { isValid: false, message: INVALID_VARIANTS_MESSAGE };
  }

  const { optionGroupIds, productGroups } = parsed.data;
  const storeGroups = await getStoreOptionGroupsByIds(storeId, optionGroupIds);
  const ownedGroups = productId ? await getProductOwnedOptionGroups(storeId, productId) : [];
  const resolved = resolveProductGroups({
    optionGroupIds,
    productGroups,
    variants: parsed.data.variants,
    storeGroups: storeGroups.map(toPickedGroup),
    existingProductGroups: ownedGroups.map(toPickedGroup),
    createId: () => crypto.randomUUID(),
  });

  if (!resolved.isValid) {
    return resolved;
  }

  const product = productId ? await getProduct(storeId, productId, { includePlanVariants: true }) : null;
  const existingVariants = (product?.variants ?? []).map(({ _count, ...variant }) => ({
    ...variant,
    hasOrders: _count.orderItems > 0,
  }));

  const plan = planVariantChanges({ groups: resolved.groups, existingVariants, variants: resolved.variants });

  if (!plan.isValid) {
    return plan;
  }

  return { isValid: true, groupIds: resolved.groupIds, plan, productGroupWrites: resolved.writes };
};

const toPickedGroup = (group: { id: string; values: { id: string }[] }) => ({
  id: group.id,
  valueIds: group.values.map((value) => value.id),
});

// The only place variant rows (and so variant prices) are written, so price history can be added here later.
export const saveProductVariants = async (
  tx: Prisma.TransactionClient,
  { storeId, productId, groupIds, plan, productGroupWrites }: SaveOptions,
): Promise<void> => {
  // Product groups first: new variants may use their new values
  await saveProductGroups(tx, { storeId, productId, writes: productGroupWrites });

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

  await removeUnusedProductGroups(tx, { productId, writes: productGroupWrites });
};

type ProductGroupSaveOptions = {
  storeId: string;
  productId: string;
  writes: ProductGroupWrites;
};

const saveProductGroups = async (
  tx: Prisma.TransactionClient,
  { storeId, productId, writes }: ProductGroupSaveOptions,
) => {
  for (const { id, name, values } of writes.groupCreates) {
    await tx.optionGroup.create({ data: { id, storeId, productId, name, values: { create: values } } });
  }

  for (const { id, name, valueCreates, valueUpdates } of writes.groupUpdates) {
    await tx.optionGroup.update({ where: { id }, data: { name, values: { create: valueCreates } } });

    for (const { id: valueId, label, position } of valueUpdates) {
      await tx.optionValue.update({ where: { id: valueId }, data: { label, position } });
    }
  }
};

// Runs after the variant writes: left-out product groups and values go, unless a variant still uses them
// (an archived variant with orders keeps its values). Store-level groups are never touched here.
const removeUnusedProductGroups = async (
  tx: Prisma.TransactionClient,
  { productId, writes }: Omit<ProductGroupSaveOptions, 'storeId'>,
) => {
  await tx.optionValue.deleteMany({
    where: { id: { in: writes.removedValueIds }, group: { productId }, variants: { none: {} } },
  });
  // A removed group kept for an archived variant still loses its unused values
  await tx.optionValue.deleteMany({
    where: { group: { id: { in: writes.removedGroupIds }, productId }, variants: { none: {} } },
  });
  await tx.optionGroup.deleteMany({
    where: { id: { in: writes.removedGroupIds }, productId, values: { none: {} } },
  });
};

// Prisma's emulated Restrict fired: a variant planned for deletion got order items after it was checked
export const isVariantWithOrdersError = (error: unknown): boolean => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === RELATION_VIOLATION_ERROR_CODE;
};
