import { resolveVariantPrices } from '@/lib/product-pricing';
import { DEFAULT_COMBINATION_KEY, getAvailableStockCount, getDefaultVariant } from '@/lib/product-variant';
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
  const optionVariants = variants.filter((variant) => variant.combinationKey !== DEFAULT_COMBINATION_KEY);
  const activeOptionVariants = optionVariants.filter((variant) => !variant.isArchived);
  const defaultVariant = getDefaultVariant(variants);
  // A product with options never falls back to its default variant: if all option variants are archived it is
  // unavailable. Archived option variants left over after all groups were removed don't count (ADR 0001).
  const hasOptions = groups.length > 0 || activeOptionVariants.length > 0;

  if (hasOptions || !defaultVariant) {
    return {
      ...product,
      hasOptions: true,
      stockCount: getAvailableStockCount(activeOptionVariants),
      options: getUsedOptions({ groups, variants: activeOptionVariants }),
      variants: activeOptionVariants.map((variant) => toPublicVariant({ product, variant, groups })),
    };
  }

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
