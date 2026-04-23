import { z } from 'zod';

export const productFormSchema = z.object({
  name: z.string().min(1),
  images: z.object({ url: z.string() }).array(),
  price: z.coerce.number().min(1),
  amountInStock: z.coerce.number().min(0),
  subcategoryId: z.string().min(1),
  isFeatured: z.boolean().default(false).optional(),
  isArchived: z.boolean().default(false).optional(),
  description: z.string().default(''),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
