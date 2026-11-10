import { resolveVariantPrices } from '@/lib/product-pricing';
import { getAvailableStockCount, getSellableVariants } from '@/lib/product-variant';
import { getVariantLabel } from '@/lib/variant-label';

type OptionValueInput = {
  id: string;
  label: string;
};

type OptionGroupInput<TValue extends OptionValueInput> = {
  id: string;
  name: string;
  // Values in display order
  values: TValue[];
};

type VariantInput<TPrice> = {
  id: string;
  sku: string | null;
  stockCount: number;
  price: TPrice | null;
  salePrice: TPrice | null;
  isArchived: boolean;
  combinationKey: string;
  optionValues: { optionValueId: string }[];
};

type ProductInput<TPrice, TValue extends OptionValueInput, TGroup extends OptionGroupInput<TValue>> = {
  price: TPrice;
  salePrice: TPrice | null;
  variants: VariantInput<TPrice>[];
  // The product's group links in display order
  optionGroups: { group: TGroup }[];
};

// The one public product shape shared by the list, catalog and single-product responses.
export const buildPublicProduct = <
  TPrice,
  TValue extends OptionValueInput,
  TGroup extends OptionGroupInput<TValue>,
  TProduct extends ProductInput<TPrice, TValue, TGroup>,
>({
  variants,
  optionGroups,
  ...product
}: TProduct & ProductInput<TPrice, TValue, TGroup>) => {
  const groups = optionGroups.map(({ group }) => group);
  const sellableVariants = getSellableVariants({ hasOptionGroups: groups.length > 0, variants });

  if (sellableVariants.hasOptions) {
    const { optionVariants } = sellableVariants;

    return {
      ...product,
      hasOptions: true,
      stockCount: getAvailableStockCount(optionVariants),
      options: getUsedOptions({ groups, variants: optionVariants }),
      variants: optionVariants.map((variant) => toPublicVariant({ product, variant, groups })),
    };
  }

  const { defaultVariant } = sellableVariants;

  return {
    ...product,
    ...resolveVariantPrices({ product, variant: defaultVariant }),
    stockCount: defaultVariant.stockCount,
    hasOptions: false,
    options: [],
    variants: [],
  };
};

// Groups and values in display order, keeping only values the given variants use
const getUsedOptions = <TValue extends OptionValueInput, TGroup extends OptionGroupInput<TValue>>({
  groups,
  variants,
}: {
  groups: TGroup[];
  variants: VariantInput<unknown>[];
}) => {
  const usedValueIds = new Set(variants.flatMap(getOptionValueIds));

  return groups
    .map((group) => ({ ...group, values: group.values.filter(({ id }) => usedValueIds.has(id)) }))
    .filter((group) => group.values.length > 0);
};

const toPublicVariant = <TPrice, TValue extends OptionValueInput>({
  product,
  variant,
  groups,
}: {
  product: { price: TPrice; salePrice: TPrice | null };
  variant: VariantInput<TPrice>;
  groups: OptionGroupInput<TValue>[];
}) => {
  const valueIds = new Set(getOptionValueIds(variant));
  const selections = groups.flatMap((group) => {
    const value = group.values.find(({ id }) => valueIds.has(id));

    return value ? [{ group, value }] : [];
  });

  return {
    id: variant.id,
    sku: variant.sku,
    label: getVariantLabel(selections.map(({ group, value }) => ({ name: group.name, value: value.label }))),
    optionValueIds: selections.map(({ value }) => value.id),
    ...resolveVariantPrices({ product, variant }),
    stockCount: variant.stockCount,
  };
};

const getOptionValueIds = ({ optionValues }: Pick<VariantInput<unknown>, 'optionValues'>) => {
  return optionValues.map(({ optionValueId }) => optionValueId);
};

type UsedImageTagsOptions<TImage extends { optionValueId: string | null }> = {
  images: TImage[];
  // The public product's `options`: only values its active variants use
  options: OptionGroupInput<OptionValueInput>[];
};

// Image tags for the single-product response: a tag on a value the product no longer shows becomes null
export const withUsedImageTags = <TImage extends { optionValueId: string | null }>({
  images,
  options,
}: UsedImageTagsOptions<TImage>): TImage[] => {
  const shownValueIds = new Set(options.flatMap(({ values }) => values.map(({ id }) => id)));

  return images.map((image) => ({
    ...image,
    optionValueId: image.optionValueId !== null && shownValueIds.has(image.optionValueId) ? image.optionValueId : null,
  }));
};
