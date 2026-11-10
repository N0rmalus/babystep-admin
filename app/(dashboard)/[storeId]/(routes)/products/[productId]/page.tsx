import { redirect } from 'next/navigation';
import { ProductForm } from './components/product-form';
import { EMPTY_DEFAULT_VARIANT } from './components/schema';
import { Page } from '@/components/dashboard/page';
import { getCategories } from '@/queries/get-categories';
import { DEFAULT_COMBINATION_KEY } from '@/lib/product-variant';
import { getOptionGroups } from '@/queries/get-option-groups';
import { getProduct } from '@/queries/get-product';
import { getSubcategories } from '@/queries/get-subcategories';
import { getVariantReservedCounts } from '@/queries/get-variant-reserved-counts';

type Props = {
  params: Promise<{
    productId: string;
    storeId: string;
  }>;
};

const ProductPage = async (props: Props) => {
  const params = await props.params;
  const categories = await getCategories(params.storeId);
  const subcategories = await getSubcategories(params.storeId);
  const optionGroups = await getOptionGroups(params.storeId);

  const product = await getProduct(params.storeId, params.productId, {
    includeVariantEditor: true,
  });

  if (params.productId !== 'new' && !product) {
    redirect(`/${params.storeId}/products`);
  }

  const reservedCounts = await getVariantReservedCounts(product?.variants.map(({ id }) => id) ?? []);

  const storeGroups = optionGroups.map(({ id, name, role, values }) => ({
    id,
    name,
    role,
    values: values.map((value) => ({ id: value.id, label: value.label })),
  }));
  const productGroups = product?.ownedOptionGroups ?? [];
  const chosenGroups = product ? getChosenGroups({ product, groups: [...storeGroups, ...productGroups] }) : [];
  const serializedProduct = product
    ? {
        ...product,
        optionGroups: chosenGroups,
        productGroups,
        variants: getVariantRows({ variants: product.variants, hasGroups: chosenGroups.length > 0 }),
        price: Number(product.price),
        salePrice: product.salePrice ? Number(product.salePrice) : null,
        saleStartsAt: product.saleStartsAt?.toISOString() ?? null,
        saleEndsAt: product.saleEndsAt?.toISOString() ?? null,
      }
    : null;

  return (
    <Page>
      <ProductForm
        subcategories={subcategories}
        categories={categories}
        storeGroups={storeGroups}
        initialData={serializedProduct}
        reservedCounts={reservedCounts}
      />
    </Page>
  );
};

export default ProductPage;

type ChosenGroupsOptions = {
  product: { optionGroups: { groupId: string }[]; variants: { optionValues: { optionValueId: string }[] }[] };
  // Store-level and product groups, each with its values in order
  groups: { id: string; values: { id: string }[] }[];
};

// The product's groups in order, each with the values its active variants use (in the group's value order)
const getChosenGroups = ({ product, groups }: ChosenGroupsOptions) => {
  const usedValueIds = new Set(
    product.variants.flatMap((variant) => variant.optionValues.map(({ optionValueId }) => optionValueId)),
  );

  return product.optionGroups.flatMap(({ groupId }) => {
    const group = groups.find(({ id }) => id === groupId);

    if (!group) {
      return [];
    }

    return [{ id: groupId, valueIds: group.values.flatMap(({ id }) => (usedValueIds.has(id) ? [id] : [])) }];
  });
};

type EditorVariant = {
  id: string;
  sku: string | null;
  stockCount: number;
  price: { toNumber: () => number } | null;
  salePrice: { toNumber: () => number } | null;
  combinationKey: string;
  optionValues: { optionValueId: string }[];
};

type VariantRowsOptions = {
  variants: EditorVariant[];
  hasGroups: boolean;
};

// A product without groups edits only its default variant, or an empty default row if it has none (ADR 0001).
// That also covers a product whose store-level groups were deleted: its option variants are left out.
const getVariantRows = ({ variants, hasGroups }: VariantRowsOptions) => {
  if (!hasGroups) {
    const defaultVariant = variants.find((variant) => variant.combinationKey === DEFAULT_COMBINATION_KEY);

    return defaultVariant ? [toVariantRow(defaultVariant)] : [EMPTY_DEFAULT_VARIANT];
  }

  return variants.map(toVariantRow);
};

const toVariantRow = (variant: EditorVariant) => ({
  id: variant.id,
  optionValueIds: variant.optionValues.map(({ optionValueId }) => optionValueId),
  sku: variant.sku ?? '',
  stockCount: variant.stockCount,
  price: variant.price?.toNumber() ?? null,
  salePrice: variant.salePrice?.toNumber() ?? null,
  // The editor loads active variants only; an archived one comes back when its combination is generated again
  isArchived: false,
});
