import 'server-only';

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { planImageWrites, submittedImageSchema, type SubmittedImage } from '@/lib/product-images';

type SaveProductImagesOptions = {
  productId: string;
  images: SubmittedImage[];
};

const submittedImagesSchema = z.array(submittedImageSchema).min(1);

export const parseSubmittedImages = (value: unknown): SubmittedImage[] | null => {
  const result = submittedImagesSchema.safeParse(value);

  return result.success ? result.data : null;
};

// Keeps the product's image rows: updates kept ones by id, creates new ones and deletes removed ones, so each
// row's id (and anything linked to it) survives a save. `position` follows the submitted order.
export const saveProductImages = async (
  tx: Prisma.TransactionClient,
  { productId, images }: SaveProductImagesOptions,
): Promise<void> => {
  const existing = await tx.image.findMany({
    where: { productId },
    select: { id: true, url: true, position: true },
  });
  const { creates, updates, deleteIds } = planImageWrites({ existing, submitted: images });

  if (deleteIds.length > 0) {
    await tx.image.deleteMany({ where: { productId, id: { in: deleteIds } } });
  }

  for (const { id, url, position } of updates) {
    await tx.image.update({ where: { id }, data: { url, position } });
  }

  if (creates.length > 0) {
    await tx.image.createMany({ data: creates.map((image) => ({ ...image, productId })) });
  }
};
