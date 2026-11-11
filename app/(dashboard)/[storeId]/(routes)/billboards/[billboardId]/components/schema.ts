import { z } from 'zod';

import { cloudinaryImageUrlSchema } from '@/lib/cloudinary-url';

export const billboardFormSchema = z.object({
  label: z.string().min(1),
  imageUrl: z.string().min(1).pipe(cloudinaryImageUrlSchema),
});

export type BillboardFormValues = z.infer<typeof billboardFormSchema>;
