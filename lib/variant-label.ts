import { z } from 'zod';

export type OrderItemSnapshot = {
  productName: string;
  // OrderItem.options JSON: [{ name: 'Dydis', value: '0–6 mėn.' }], in group order
  options: unknown;
};

const LABEL_SEPARATOR = ' · ';
const NAME_SEPARATOR = ' – ';

const snapshotOptionsSchema = z.array(z.object({ name: z.string(), value: z.string() }));

export type VariantOption = z.infer<typeof snapshotOptionsSchema>[number];

// The variant label, e.g. "Dydis: 0–6 mėn. · Spalva: Šalavijų". Empty for a default variant.
export const getVariantLabel = (options: VariantOption[]): string => {
  return options.map(({ name, value }) => `${name}: ${value}`).join(LABEL_SEPARATOR);
};

// The full item text, e.g. "Muslino merliukas – Dydis: 0–6 mėn.". A default-variant item is just the product name.
export const getOrderItemText = ({ productName, options }: OrderItemSnapshot): string => {
  const label = getVariantLabel(parseSnapshotOptions(options));

  if (!label) {
    return productName;
  }

  return `${productName}${NAME_SEPARATOR}${label}`;
};

const parseSnapshotOptions = (options: unknown) => {
  const result = snapshotOptionsSchema.safeParse(options);

  return result.success ? result.data : [];
};
