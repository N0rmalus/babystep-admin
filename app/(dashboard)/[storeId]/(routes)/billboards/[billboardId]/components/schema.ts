import { z } from 'zod';

export const billboardFormSchema = z.object({
  label: z.string().min(1),
  imageUrl: z.string().min(1),
});

export type BillboardFormValues = z.infer<typeof billboardFormSchema>;
