import { findDuplicateLabel, getDuplicateValueMessage, VALUE_LABEL_REQUIRED_MESSAGE } from '@/lib/option-group';

export const DUPLICATE_GROUP_MESSAGE = 'Ta pati savybė pasirinkta kelis kartus';
export const GROUP_NOT_FOUND_MESSAGE = 'Savybė šioje parduotuvėje nerasta';
export const GROUP_NAME_REQUIRED_MESSAGE = 'Būtina nurodyti savybės pavadinimą';
const INVALID_PRODUCT_GROUP_MESSAGE = 'Neteisingi prekės savybės duomenys';

type PickedGroup = {
  id: string;
  valueIds: string[];
};

export type SubmittedProductGroup = {
  // A product group's own id, or a temporary id from the form for a new group (same for values)
  id: string;
  name: string;
  values: { id: string; label: string }[];
};

type ResolveOptions<TVariant extends { optionValueIds: string[] }> = {
  // Every chosen group in order: store-level group ids and submitted product group ids
  optionGroupIds: string[];
  productGroups: SubmittedProductGroup[];
  variants: TVariant[];
  // The store-level groups among optionGroupIds, each with every value id
  storeGroups: PickedGroup[];
  // The groups this product already owns, each with every value id
  existingProductGroups: PickedGroup[];
  createId: () => string;
};

type PositionedValue = { id: string; label: string; position: number };

export type ProductGroupWrites = {
  groupCreates: { id: string; name: string; values: PositionedValue[] }[];
  groupUpdates: { id: string; name: string; valueCreates: PositionedValue[]; valueUpdates: PositionedValue[] }[];
  // Left out of the form: deleted on save unless a variant (an archived one with orders) still uses them
  removedGroupIds: string[];
  removedValueIds: string[];
};

type ResolveResult<TVariant> =
  | {
      isValid: true;
      groupIds: string[];
      groups: PickedGroup[];
      variants: TVariant[];
      writes: ProductGroupWrites;
    }
  | { isValid: false; message: string };

// Resolves the product groups submitted with the product form: new groups and values get server ids
// (the form's temporary ids are never stored) and the variants are rewritten to use them.
export const resolveProductGroups = <TVariant extends { optionValueIds: string[] }>({
  optionGroupIds,
  productGroups,
  variants,
  storeGroups,
  existingProductGroups,
  createId,
}: ResolveOptions<TVariant>): ResolveResult<TVariant> => {
  const trimmedProductGroups = productGroups.map((group) => ({
    ...group,
    name: group.name.trim(),
    values: group.values.map((value) => ({ ...value, label: value.label.trim() })),
  }));
  const validationMessage = getValidationMessage({
    optionGroupIds,
    productGroups: trimmedProductGroups,
    storeGroups,
  });

  if (validationMessage) {
    return { isValid: false, message: validationMessage };
  }

  const serverIdBySubmittedId = new Map<string, string>();
  const groupCreates: ProductGroupWrites['groupCreates'] = [];
  const groupUpdates: ProductGroupWrites['groupUpdates'] = [];
  const removedValueIds: string[] = [];
  const resolvedProductGroups: PickedGroup[] = [];

  for (const productGroup of trimmedProductGroups) {
    const existingGroup = existingProductGroups.find(({ id }) => id === productGroup.id);
    const groupId = existingGroup ? existingGroup.id : createId();
    // Only ids of this group's own values are kept; anything else is a new value
    const values = productGroup.values.map((value, position) => {
      const isExisting = existingGroup?.valueIds.includes(value.id) ?? false;
      const valueId = isExisting ? value.id : createId();

      serverIdBySubmittedId.set(value.id, valueId);

      return { id: valueId, label: value.label, position, isExisting };
    });

    serverIdBySubmittedId.set(productGroup.id, groupId);
    resolvedProductGroups.push({ id: groupId, valueIds: values.map(({ id }) => id) });

    if (!existingGroup) {
      groupCreates.push({ id: groupId, name: productGroup.name, values: values.map(toPositionedValue) });
      continue;
    }

    groupUpdates.push({
      id: groupId,
      name: productGroup.name,
      valueCreates: values.filter(({ isExisting }) => !isExisting).map(toPositionedValue),
      valueUpdates: values.filter(({ isExisting }) => isExisting).map(toPositionedValue),
    });
    removedValueIds.push(...existingGroup.valueIds.filter((valueId) => !values.some(({ id }) => id === valueId)));
  }

  const toServerId = (id: string) => serverIdBySubmittedId.get(id) ?? id;
  const groups = optionGroupIds.flatMap((groupId) => {
    const productGroup = resolvedProductGroups.find(({ id }) => id === toServerId(groupId));

    if (productGroup) {
      return [productGroup];
    }

    const storeGroup = storeGroups.find(({ id }) => id === groupId);

    return storeGroup ? [storeGroup] : [];
  });

  return {
    isValid: true,
    groupIds: groups.map(({ id }) => id),
    groups,
    variants: variants.map((variant) => ({ ...variant, optionValueIds: variant.optionValueIds.map(toServerId) })),
    writes: {
      groupCreates,
      groupUpdates,
      removedGroupIds: existingProductGroups
        .filter((group) => !resolvedProductGroups.some(({ id }) => id === group.id))
        .map(({ id }) => id),
      removedValueIds,
    },
  };
};

type ValidationOptions = {
  optionGroupIds: string[];
  productGroups: SubmittedProductGroup[];
  storeGroups: PickedGroup[];
};

const getValidationMessage = ({ optionGroupIds, productGroups, storeGroups }: ValidationOptions) => {
  const storeGroupIds = storeGroups.map(({ id }) => id);
  const storeIds = new Set([...storeGroupIds, ...storeGroups.flatMap(({ valueIds }) => valueIds)]);
  // Submitted product-group ids get remapped, so one that is a store-level id would rewrite store selections
  const reusesStoreId = productGroups.some(
    ({ id, values }) => storeIds.has(id) || values.some((value) => storeIds.has(value.id)),
  );

  if (reusesStoreId) {
    return INVALID_PRODUCT_GROUP_MESSAGE;
  }

  if (new Set(optionGroupIds).size !== optionGroupIds.length) {
    return DUPLICATE_GROUP_MESSAGE;
  }

  const productGroupIds = productGroups.map(({ id }) => id);
  const hasUnknownGroup = optionGroupIds.some(
    (groupId) => !productGroupIds.includes(groupId) && !storeGroupIds.includes(groupId),
  );
  // A product group exists only while the product uses it
  const hasUnchosenProductGroup = productGroupIds.some((groupId) => !optionGroupIds.includes(groupId));

  if (hasUnknownGroup || hasUnchosenProductGroup) {
    return GROUP_NOT_FOUND_MESSAGE;
  }

  for (const { name, values } of productGroups) {
    if (name.length === 0) {
      return GROUP_NAME_REQUIRED_MESSAGE;
    }

    if (values.some(({ label }) => label.length === 0)) {
      return VALUE_LABEL_REQUIRED_MESSAGE;
    }

    const duplicateValue = findDuplicateLabel(values);

    if (duplicateValue) {
      return getDuplicateValueMessage(duplicateValue.label);
    }
  }

  return null;
};

const toPositionedValue = ({ id, label, position }: PositionedValue) => ({ id, label, position });
