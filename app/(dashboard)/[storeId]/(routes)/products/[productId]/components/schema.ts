import { z } from 'zod';
import { GROUP_NAME_REQUIRED_MESSAGE } from '@/lib/product-groups';
import { getVariantPriceMessage, MAX_OPTION_GROUP_COUNT, TOO_MANY_GROUPS_MESSAGE } from '@/lib/variant-plan';

const SKU_MAX_LENGTH = 64;
const GENERATE_VARIANTS_PROMPT = 'Pasirinkite reikšmes ir sugeneruokite derinius';

export const getOptionalNumericInput = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' && value.trim().length === 0) {
    return null;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : null;
};

const optionalPositiveNumberSchema = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .refine((value) => {
    const numericValue = getOptionalNumericInput(value);

    return numericValue === null || numericValue > 0;
  }, 'Akcijos kaina turi būti didesnė už 0');

const optionalDateTimeSchema = z
  .string()
  .nullable()
  .optional()
  .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
    message: 'Neteisinga data',
  });

const optionalPriceInputSchema = z.union([z.string(), z.number(), z.null()]);

// A variant row: the default variant of a product without groups, or one combination in the variant table
const variantRowSchema = z
  .object({
    id: z.string().optional(),
    optionValueIds: z.array(z.string()),
    sku: z.string().trim().max(SKU_MAX_LENGTH, `SKU negali būti ilgesnis nei ${SKU_MAX_LENGTH} simbolių`),
    stockCount: z.coerce.number().int('Kiekis turi būti sveikasis skaičius').min(0, 'Kiekis negali būti neigiamas'),
    // Empty price = inherit the product's price and sale price
    price: optionalPriceInputSchema,
    salePrice: optionalPriceInputSchema,
    // Archived variants stay in the table, greyed out, until the owner restores them
    isArchived: z.boolean(),
  })
  .superRefine((row, context) => {
    const price = getOptionalNumericInput(row.price);
    const message = getVariantPriceMessage({ price, salePrice: getOptionalNumericInput(row.salePrice) });

    if (message) {
      context.addIssue({ code: 'custom', path: [price !== null && price <= 0 ? 'price' : 'salePrice'], message });
    }
  });

export const productFormSchema = z
  .object({
    name: z.string().min(1),
    images: z.object({ url: z.string() }).array(),
    price: z.coerce.number().min(1),
    salePrice: optionalPositiveNumberSchema,
    saleStartsAt: optionalDateTimeSchema,
    saleEndsAt: optionalDateTimeSchema,
    // Chosen groups in order, each with the values the product uses
    optionGroups: z
      .array(z.object({ id: z.string(), valueIds: z.array(z.string()) }))
      .max(MAX_OPTION_GROUP_COUNT, TOO_MANY_GROUPS_MESSAGE),
    // Product groups this product owns, with every value (chosen or not); new ones have temporary ids
    productGroups: z.array(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1, GROUP_NAME_REQUIRED_MESSAGE),
        values: z.array(z.object({ id: z.string(), label: z.string() })),
      }),
    ),
    variants: z.array(variantRowSchema),
    subcategoryId: z.string().min(1),
    isFeatured: z.boolean().default(false).optional(),
    isArchived: z.boolean().default(false).optional(),
    description: z.string(),
  })
  .refine(
    (data) => {
      const salePrice = getOptionalNumericInput(data.salePrice);

      return salePrice === null || salePrice < data.price;
    },
    {
      path: ['salePrice'],
      message: 'Akcijos kaina turi būti mažesnė už įprastą kainą',
    },
  )
  .refine(
    (data) =>
      !data.saleStartsAt ||
      !data.saleEndsAt ||
      new Date(data.saleStartsAt).getTime() <= new Date(data.saleEndsAt).getTime(),
    {
      path: ['saleEndsAt'],
      message: 'Akcijos pabaiga turi būti po pradžios',
    },
  )
  .refine(
    (data) => {
      const salePrice = getOptionalNumericInput(data.salePrice);

      return salePrice !== null || (!data.saleStartsAt && !data.saleEndsAt);
    },
    {
      path: ['salePrice'],
      message: 'Akcijos datas galima nurodyti tik kartu su akcijos kaina',
    },
  )
  .refine((data) => data.optionGroups.length === 0 || data.variants.length > 0, {
    path: ['variants'],
    message: GENERATE_VARIANTS_PROMPT,
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;
export type VariantRow = ProductFormValues['variants'][number];
export type ProductGroup = ProductFormValues['productGroups'][number];

export const EMPTY_DEFAULT_VARIANT = {
  optionValueIds: [],
  sku: '',
  stockCount: 0,
  price: null,
  salePrice: null,
  isArchived: false,
} satisfies VariantRow;

// The request body's variant part (see lib/product-variant-writes.ts). Only chosen product groups are sent, each
// with the values the product uses; the server removes the rest unless a variant still uses them.
export const toVariantPayload = ({
  optionGroups,
  productGroups,
  variants,
}: Pick<ProductFormValues, 'optionGroups' | 'productGroups' | 'variants'>) => ({
  optionGroupIds: optionGroups.map(({ id }) => id),
  productGroups: productGroups.flatMap(({ id, name, values }) => {
    const chosenGroup = optionGroups.find((group) => group.id === id);

    return chosenGroup ? [{ id, name, values: values.filter((value) => chosenGroup.valueIds.includes(value.id)) }] : [];
  }),
  variants: variants.map((variant) => ({
    ...variant,
    price: getOptionalNumericInput(variant.price),
    salePrice: getOptionalNumericInput(variant.salePrice),
  })),
});
