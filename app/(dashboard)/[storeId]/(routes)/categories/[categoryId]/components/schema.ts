import { z } from 'zod';

export const categoryFormSchema = z.object({
  name: z.string().min(1),
  billboardId: z.string().min(1),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
