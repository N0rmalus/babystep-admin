import { getProductSaleValidationMessage } from '@/lib/product-pricing';
import {
  getCombinationKey,
  INVALID_STOCK_COUNT_MESSAGE,
  isValidStockCount,
  normalizeOptionalSku,
} from '@/lib/product-variant';

export const MAX_OPTION_GROUP_COUNT = 3;
export const TOO_MANY_GROUPS_MESSAGE = `Prekė gali turėti ne daugiau kaip ${MAX_OPTION_GROUP_COUNT} savybes`;
const INVALID_COMBINATION_MESSAGE = 'Kiekvienas variantas turi turėti po vieną kiekvienos savybės reikšmę';
const getDuplicateSkuMessage = (sku: string) => `SKU „${sku}“ kartojasi keliuose variantuose`;
export const SALE_PRICE_WITHOUT_PRICE_MESSAGE = 'Akcijos kainą galima nurodyti tik kartu su varianto kaina';
const DEFAULT_VARIANT_COUNT_MESSAGE = 'Prekė be savybių turi turėti vieną variantą';
const DEFAULT_VARIANT_PRICE_MESSAGE = 'Prekė be savybių naudoja prekės kainą';
const DEFAULT_VARIANT_ARCHIVED_MESSAGE = 'Prekė be savybių turi turėti aktyvų variantą';
const NO_VARIANTS_MESSAGE = 'Sugeneruokite bent vieną variantą';
const VARIANT_NOT_FOUND_MESSAGE = 'Variantas šioje prekėje nerastas';
const COMBINATION_CHANGED_MESSAGE = 'Esamo varianto reikšmių keisti negalima';
export const DUPLICATE_COMBINATION_MESSAGE =
  'Toks reikšmių derinys jau yra. Kiekvienas derinys gali būti tik vieną kartą.';

type PickedGroup = {
  id: string;
  valueIds: string[];
};

type GenerateOptions = {
  groups: PickedGroup[];
  variants: { optionValueIds: string[] }[];
};

// Every combination of the picked values (one per group, in group order) that no variant has yet.
export const generateMissingCombinations = ({ groups, variants }: GenerateOptions): string[][] => {
  if (groups.length === 0) {
    return [];
  }

  const existingKeys = new Set(variants.map((variant) => getCombinationKey(variant.optionValueIds)));
  const combinations = groups.reduce<string[][]>(
    (partialCombinations, group) =>
      partialCombinations.flatMap((combination) => group.valueIds.map((valueId) => [...combination, valueId])),
    [[]],
  );

  return combinations.filter((combination) => !existingKeys.has(getCombinationKey(combination)));
};

export type VariantInput = {
  id?: string;
  optionValueIds: string[];
  sku: string | null;
  stockCount: number;
  price: number | null;
  salePrice: number | null;
  // Set by the owner to withdraw one combination from sale without deleting it
  isArchived: boolean;
};

type ExistingVariant = {
  id: string;
  combinationKey: string;
  isArchived: boolean;
  hasOrders: boolean;
};

type PlanOptions = {
  // The product's groups in order, each with every value it allows
  groups: PickedGroup[];
  existingVariants: ExistingVariant[];
  variants: VariantInput[];
};

type PlannedVariant = Omit<VariantInput, 'id'> & { combinationKey: string };

type VariantPlan =
  | {
      isValid: true;
      creates: PlannedVariant[];
      updates: (PlannedVariant & { id: string })[];
      deleteIds: string[];
      archiveIds: string[];
    }
  | { isValid: false; message: string };

// Turns the variant table the owner submitted into writes against the product's existing variants.
export const planVariantChanges = ({ groups, existingVariants, variants }: PlanOptions): VariantPlan => {
  const validationMessage = getValidationMessage({ groups, existingVariants, variants });

  if (validationMessage) {
    return { isValid: false, message: validationMessage };
  }

  const submittedIds = new Set(variants.flatMap(({ id }) => (id ? [id] : [])));
  // A new row whose combination an unsubmitted variant (e.g. an archived one) already has reuses that variant
  const reusableIdByKey = new Map(
    existingVariants
      .filter((variant) => !submittedIds.has(variant.id))
      .map((variant) => [variant.combinationKey, variant.id]),
  );
  const plannedVariants = variants.map(({ id, ...variant }) => {
    const combinationKey = getCombinationKey(variant.optionValueIds);

    return {
      id: id ?? reusableIdByKey.get(combinationKey),
      // An archived variant gives up its SKU so it can be reused, as when it is archived by removal
      variant: { ...variant, sku: variant.isArchived ? null : normalizeOptionalSku(variant.sku), combinationKey },
    };
  });

  const keptIds = new Set(plannedVariants.flatMap(({ id }) => (id ? [id] : [])));
  // A variant with orders is never deleted, only archived, so past orders keep their link
  const leftOutVariants = existingVariants.filter((variant) => !variant.isArchived && !keptIds.has(variant.id));

  return {
    isValid: true,
    creates: plannedVariants.flatMap(({ id, variant }) => (id ? [] : [variant])),
    updates: plannedVariants.flatMap(({ id, variant }) => (id ? [{ id, ...variant }] : [])),
    deleteIds: leftOutVariants.flatMap((variant) => (variant.hasOrders ? [] : [variant.id])),
    archiveIds: leftOutVariants.flatMap((variant) => (variant.hasOrders ? [variant.id] : [])),
  };
};

const getValidationMessage = ({ groups, existingVariants, variants }: PlanOptions) => {
  if (groups.length > MAX_OPTION_GROUP_COUNT) {
    return TOO_MANY_GROUPS_MESSAGE;
  }

  if (groups.length === 0) {
    const defaultVariantMessage = getDefaultVariantMessage(variants);

    if (defaultVariantMessage) {
      return defaultVariantMessage;
    }
  }

  if (variants.length === 0) {
    return NO_VARIANTS_MESSAGE;
  }

  if (variants.some((variant) => !hasOneValuePerGroup(variant.optionValueIds, groups))) {
    return INVALID_COMBINATION_MESSAGE;
  }

  const idMessage = getIdMessage({ existingVariants, variants });

  if (idMessage) {
    return idMessage;
  }

  if (hasDuplicates(variants.map((variant) => getCombinationKey(variant.optionValueIds)))) {
    return DUPLICATE_COMBINATION_MESSAGE;
  }

  if (variants.some((variant) => !isValidStockCount(variant.stockCount))) {
    return INVALID_STOCK_COUNT_MESSAGE;
  }

  const priceMessage = variants.map(getVariantPriceMessage).find((message) => message !== null);

  if (priceMessage) {
    return priceMessage;
  }

  // Archived variants give up their SKU, so only active ones can clash
  const duplicateSku = findDuplicate(
    variants.flatMap((variant) => (variant.isArchived ? [] : (normalizeOptionalSku(variant.sku) ?? []))),
  );

  if (duplicateSku) {
    return getDuplicateSkuMessage(duplicateSku);
  }

  return null;
};

const hasOneValuePerGroup = (optionValueIds: string[], groups: PickedGroup[]) => {
  return (
    optionValueIds.length === groups.length &&
    groups.every((group) => optionValueIds.filter((valueId) => group.valueIds.includes(valueId)).length === 1)
  );
};

const hasDuplicates = (keys: string[]) => new Set(keys).size !== keys.length;

const findDuplicate = (keys: string[]) => keys.find((key, index) => keys.indexOf(key) !== index);

// The sale window stays on the product, so only the price pair is checked here.
export const getVariantPriceMessage = ({ price, salePrice }: Pick<VariantInput, 'price' | 'salePrice'>) => {
  if (price === null) {
    return salePrice === null ? null : SALE_PRICE_WITHOUT_PRICE_MESSAGE;
  }

  return getProductSaleValidationMessage({ price, salePrice, saleStartsAt: null, saleEndsAt: null });
};

// ADR 0001: a product without groups has exactly one default variant, priced by the product itself.
const getDefaultVariantMessage = (variants: VariantInput[]) => {
  if (variants.length !== 1) {
    return DEFAULT_VARIANT_COUNT_MESSAGE;
  }

  if (variants.some((variant) => variant.price !== null || variant.salePrice !== null)) {
    return DEFAULT_VARIANT_PRICE_MESSAGE;
  }

  // A plain product is withdrawn from sale by archiving the product, not its only variant
  if (variants.some((variant) => variant.isArchived)) {
    return DEFAULT_VARIANT_ARCHIVED_MESSAGE;
  }

  return null;
};

// A submitted id must be an active variant of this product, and its combination stays fixed (orders point at it).
const getIdMessage = ({ existingVariants, variants }: Pick<PlanOptions, 'existingVariants' | 'variants'>) => {
  const activeKeyById = new Map(
    existingVariants.filter((variant) => !variant.isArchived).map((variant) => [variant.id, variant.combinationKey]),
  );

  for (const { id, optionValueIds } of variants) {
    if (id === undefined) {
      continue;
    }

    const combinationKey = activeKeyById.get(id);

    if (combinationKey === undefined) {
      return VARIANT_NOT_FOUND_MESSAGE;
    }

    if (combinationKey !== getCombinationKey(optionValueIds)) {
      return COMBINATION_CHANGED_MESSAGE;
    }
  }

  return null;
};
