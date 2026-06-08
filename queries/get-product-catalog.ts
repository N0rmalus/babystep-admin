import 'server-only';

import { getProductEffectivePrice, getProductPricing } from '@/lib/product-pricing';
import { getProducts, type PublicProduct } from '@/queries/get-products';

export type ProductCatalogSort = 'recommended' | 'price-asc' | 'price-desc' | 'name-asc';

type ProductPriceRange = {
  min: number;
  max: number;
};

type ProductCatalogOptions = {
  categoryId?: string;
  subcategoryId?: string;
  baseIsOnSale?: boolean;
  subcategoryIds?: string[];
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  isInStock?: boolean;
  isOnSale?: boolean;
  sort?: ProductCatalogSort;
  page?: number;
  pageSize?: number;
};

export type ProductCatalogResult = {
  products: PublicProduct[];
  totalCount: number;
  filteredCount: number;
  priceRange: ProductPriceRange;
  subcategoryCounts: Record<string, number>;
  currentPage: number;
  totalPages: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 60;

export const getProductCatalog = async (
  storeId: string,
  options: ProductCatalogOptions,
): Promise<ProductCatalogResult> => {
  // TODO(catalog-performance): Move catalog filtering/sorting/pagination into Prisma/SQL
  // once the product count grows. Current implementation filters the fetched baseProducts
  // in memory, which is fine for a small catalog but will not scale well.

  const baseProducts = await getProducts(storeId, {
    categoryId: options.categoryId,
    subcategoryId: options.subcategoryId,
    isOnSale: options.baseIsOnSale ? true : undefined,
    onlyActive: true,
    includeImages: true,
    includeSubcategoryCategory: true,
  });

  const filteredProducts = sortProducts(
    baseProducts.filter((product) => matchesCatalogFilters(product, options)),
    options.sort ?? 'recommended',
  );
  const filteredCount = filteredProducts.length;
  const pageSize = getSafePageSize(options.pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const currentPage = Math.min(Math.max(1, options.page ?? 1), totalPages);
  const pageStart = (currentPage - 1) * pageSize;

  return {
    products: filteredProducts.slice(pageStart, pageStart + pageSize),
    totalCount: baseProducts.length,
    filteredCount,
    priceRange: getProductPriceRange(baseProducts),
    subcategoryCounts: getSubcategoryCounts(baseProducts),
    currentPage,
    totalPages,
    pageSize,
  };
};

const matchesCatalogFilters = (product: PublicProduct, options: ProductCatalogOptions) => {
  const normalizedQuery = options.query?.trim().toLocaleLowerCase('lt-LT') ?? '';

  if (normalizedQuery && !matchesSearchQuery(product, normalizedQuery)) {
    return false;
  }

  if (options.subcategoryIds?.length && !options.subcategoryIds.includes(product.subcategoryId)) {
    return false;
  }

  if (options.isInStock && product.amountInStock <= 0) {
    return false;
  }

  const pricing = getProductPricing(product);

  if (options.isOnSale && !pricing.isOnSale) {
    return false;
  }

  if (options.minPrice !== undefined && pricing.effectivePrice < options.minPrice) {
    return false;
  }

  if (options.maxPrice !== undefined && pricing.effectivePrice > options.maxPrice) {
    return false;
  }

  return true;
};

const matchesSearchQuery = (product: PublicProduct, normalizedQuery: string) => {
  return getSearchableProductValues(product).some((value) =>
    value?.toLocaleLowerCase('lt-LT').includes(normalizedQuery),
  );
};

const getSearchableProductValues = (product: PublicProduct) => [
  product.name,
  product.description,
  product.subcategory?.name,
  product.subcategory?.category?.name,
];

const sortProducts = (products: PublicProduct[], sort: ProductCatalogSort) => {
  return [...products].sort((firstProduct, secondProduct) => {
    if (sort === 'price-asc') {
      return getProductEffectivePrice(firstProduct) - getProductEffectivePrice(secondProduct);
    }

    if (sort === 'price-desc') {
      return getProductEffectivePrice(secondProduct) - getProductEffectivePrice(firstProduct);
    }

    if (sort === 'name-asc') {
      return firstProduct.name.localeCompare(secondProduct.name, 'lt-LT');
    }

    const featuredDifference = Number(secondProduct.isFeatured) - Number(firstProduct.isFeatured);

    if (featuredDifference !== 0) {
      return featuredDifference;
    }

    return getProductTimestamp(secondProduct) - getProductTimestamp(firstProduct);
  });
};

const getProductPriceRange = (products: PublicProduct[]): ProductPriceRange => {
  const prices = products
    .map((product) => getProductEffectivePrice(product))
    .filter((price) => Number.isFinite(price) && price >= 0);

  if (prices.length === 0) {
    return { min: 0, max: 0 };
  }

  return {
    min: Math.floor(Math.min(...prices)),
    max: Math.ceil(Math.max(...prices)),
  };
};

const getSubcategoryCounts = (products: PublicProduct[]) => {
  const counts: Record<string, number> = {};

  products.forEach((product) => {
    counts[product.subcategoryId] = (counts[product.subcategoryId] ?? 0) + 1;
  });

  return counts;
};

const getProductTimestamp = (product: PublicProduct) => {
  const timestamp = product.createdAt.getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getSafePageSize = (pageSize?: number) => {
  if (!pageSize) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
};
