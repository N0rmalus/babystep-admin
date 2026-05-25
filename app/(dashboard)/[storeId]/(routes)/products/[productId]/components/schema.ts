import { z } from 'zod';

const getOptionalNumericInput = (value: string | number | null | undefined) => {
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

export const productFormSchema = z
  .object({
    name: z.string().min(1),
    images: z.object({ url: z.string() }).array(),
    price: z.coerce.number().min(1),
    salePrice: optionalPositiveNumberSchema,
    saleStartsAt: optionalDateTimeSchema,
    saleEndsAt: optionalDateTimeSchema,
    amountInStock: z.coerce.number().min(0),
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
  );

export type ProductFormValues = z.infer<typeof productFormSchema>;
