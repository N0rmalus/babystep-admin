import { z } from 'zod';

// One image in a product save request, in display order; saved images carry their row id
export const submittedImageSchema = z.object({ id: z.string().optional(), url: z.string().min(1) });

export type SubmittedImage = z.infer<typeof submittedImageSchema>;

type ExistingImage = {
  id: string;
  url: string;
  position: number;
};

type PlanImageWritesOptions = {
  existing: ExistingImage[];
  // In display order: the first image is the product's card image
  submitted: SubmittedImage[];
};

type ImageWritePlan = {
  creates: { url: string; position: number }[];
  updates: ExistingImage[];
  deleteIds: string[];
};

export const planImageWrites = ({ existing, submitted }: PlanImageWritesOptions): ImageWritePlan => {
  const existingById = new Map(existing.map((image) => [image.id, image]));
  const keptIds = new Set<string>();
  const plan: ImageWritePlan = { creates: [], updates: [], deleteIds: [] };

  submitted.forEach(({ id, url }, position) => {
    const current = id && !keptIds.has(id) ? existingById.get(id) : undefined;

    if (!current) {
      plan.creates.push({ url, position });
      return;
    }

    keptIds.add(current.id);

    if (current.url !== url || current.position !== position) {
      plan.updates.push({ id: current.id, url, position });
    }
  });

  plan.deleteIds = existing.filter((image) => !keptIds.has(image.id)).map((image) => image.id);

  return plan;
};
