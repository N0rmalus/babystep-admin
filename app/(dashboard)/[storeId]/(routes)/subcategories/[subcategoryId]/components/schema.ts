import { z } from 'zod';

export const subcategoryFormSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().min(1),
});

export type SubcategoryFormValues = z.infer<typeof subcategoryFormSchema>;
