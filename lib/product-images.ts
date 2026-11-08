import { z } from 'zod';

// One image in a product save request, in display order; saved images carry their row id. `optionValueId` tags
// the image with one option value the product's active variants use (none when left out).
export const submittedImageSchema = z.object({
  id: z.string().optional(),
  url: z.string().min(1),
  optionValueId: z.string().min(1).nullable().optional(),
});

export type SubmittedImage = z.infer<typeof submittedImageSchema>;

type ExistingImage = {
  id: string;
  url: string;
  position: number;
  optionValueId: string | null;
};

type PlanImageWritesOptions = {
  existing: ExistingImage[];
  // In display order: the first image is the product's card image
  submitted: SubmittedImage[];
};

type ImageWritePlan = {
  creates: Omit<ExistingImage, 'id'>[];
  updates: ExistingImage[];
  deleteIds: string[];
};

export const planImageWrites = ({ existing, submitted }: PlanImageWritesOptions): ImageWritePlan => {
  const existingById = new Map(existing.map((image) => [image.id, image]));
  const keptIds = new Set<string>();
  const plan: ImageWritePlan = { creates: [], updates: [], deleteIds: [] };

  submitted.forEach(({ id, url, optionValueId = null }, position) => {
    const current = id && !keptIds.has(id) ? existingById.get(id) : undefined;

    if (!current) {
      plan.creates.push({ url, position, optionValueId });
      return;
    }

    keptIds.add(current.id);

    if (current.url !== url || current.position !== position || current.optionValueId !== optionValueId) {
      plan.updates.push({ id: current.id, url, position, optionValueId });
    }
  });

  plan.deleteIds = existing.filter((image) => !keptIds.has(image.id)).map((image) => image.id);

  return plan;
};

export const IMAGE_TAG_NOT_USED_MESSAGE = 'Nuotraukos žyma turi būti viena iš prekės variantų reikšmių';

type ResolveImageTagsOptions = {
  images: SubmittedImage[];
  // Option value ids (server ids) the product's active variants use after this save
  usedValueIds: string[];
  // The form's temporary ids of new product group values, mapped to their server ids
  serverIdBySubmittedId: ReadonlyMap<string, string>;
};

type ResolveImageTagsResult = { isValid: true; images: SubmittedImage[] } | { isValid: false; message: string };

// Checks each image tag against the values the product uses and rewrites temporary value ids to server ids
export const resolveImageTags = ({
  images,
  usedValueIds,
  serverIdBySubmittedId,
}: ResolveImageTagsOptions): ResolveImageTagsResult => {
  const usedIds = new Set(usedValueIds);
  const resolvedImages = images.map((image) => {
    const optionValueId = image.optionValueId
      ? (serverIdBySubmittedId.get(image.optionValueId) ?? image.optionValueId)
      : null;

    return { ...image, optionValueId };
  });
  const hasUnusedTag = resolvedImages.some(
    ({ optionValueId }) => optionValueId !== null && !usedIds.has(optionValueId),
  );

  if (hasUnusedTag) {
    return { isValid: false, message: IMAGE_TAG_NOT_USED_MESSAGE };
  }

  return { isValid: true, images: resolvedImages };
};

// One choice in the image uploader's tag select, e.g. { id, label: 'Spalva: Avižų' }
export type ImageTagOption = {
  id: string;
  label: string;
};

type ImageTagSource = {
  // The product's chosen groups in order, each with its values in order
  groups: { name: string; values: { id: string; label: string }[] }[];
  variants: { optionValueIds: string[]; isArchived: boolean }[];
};

// The option values a product uses: those of its active variants. Only these can tag an image.
export const getUsedOptionValueIds = (variants: ImageTagSource['variants']): string[] => {
  return [...new Set(variants.flatMap((variant) => (variant.isArchived ? [] : variant.optionValueIds)))];
};

// What the image uploader offers as tags: "Spalva: Avižų" for every value the active variants use
export const getImageTagOptions = ({ groups, variants }: ImageTagSource): ImageTagOption[] => {
  const usedValueIds = new Set(getUsedOptionValueIds(variants));

  return groups.flatMap(({ name, values }) =>
    values.flatMap(({ id, label }) => (usedValueIds.has(id) ? [{ id, label: `${name}: ${label}` }] : [])),
  );
};
