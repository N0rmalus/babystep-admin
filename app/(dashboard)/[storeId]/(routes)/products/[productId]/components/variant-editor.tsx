'use client';

import axios from 'axios';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ChangeEvent, Dispatch, KeyboardEvent, ReactNode, SetStateAction, useId, useState } from 'react';
import { useParams } from 'next/navigation';
import type { OptionGroupRole } from '@prisma/client';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Archive, ArchiveRestore, Plus, Trash, X } from 'lucide-react';
import { AlertModal } from '@/components/modals/alert-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatter } from '@/lib/utils';
import { getFormErrorMessage } from '@/lib/get-form-error-message';
import { getNewValueMessage } from '@/lib/option-group';
import { GROUP_NAME_REQUIRED_MESSAGE } from '@/lib/product-groups';
import { BulkChanges, getBulkChanges, getBulkTargetIndexes, getKeysWithValue } from '@/lib/variant-bulk-edit';
import { generateMissingCombinations, MAX_OPTION_GROUP_COUNT } from '@/lib/variant-plan';
import { getVariantTotalStock, ReservedCounts } from '@/lib/variant-stock';
import { EMPTY_DEFAULT_VARIANT, getOptionalNumericInput, ProductFormValues, ProductGroup, VariantRow } from './schema';

type OptionValue = { id: string; label: string };

export type StoreOptionGroup = {
  id: string;
  name: string;
  role: OptionGroupRole;
  // Values in group order
  values: OptionValue[];
};

type Props = {
  // Sizes added with "+ Naujas dydis" are saved at once and join the store-level groups through onStoreGroupsChange
  storeGroups: StoreOptionGroup[];
  onStoreGroupsChange: Dispatch<SetStateAction<StoreOptionGroup[]>>;
  reservedCounts: ReservedCounts;
  isDisabled: boolean;
};

type ChosenGroup = ProductFormValues['optionGroups'][number];

type PendingValueRemoval = {
  groupId: string;
  valueId: string;
  label: string;
  rowCount: number;
};

// A group the product can choose: a store-level group (Savybės) or one of its own product groups
type GroupDefinition = ({ kind: 'store'; role: OptionGroupRole } | { kind: 'product' }) & {
  id: string;
  name: string;
  values: OptionValue[];
};

const STOCK_HINT = 'Įveskite laisvą kiekį, be rezervuotų.';
const RESERVED_HINT = 'Neapmokėtų užsakymų laikomas kiekis.';
const TOTAL_HINT = 'Laisva + Rezervuota.';
const NO_TOTAL_PLACEHOLDER = '—';
const STOCK_INPUT_CLASS = 'w-24';
const PRICE_INPUT_CLASS = 'w-28';
const SKU_INPUT_CLASS = 'w-32';
const VALUE_SEPARATOR = ' · ';
const INHERITED_PRICE_FALLBACK = 'Prekės';
const NO_SALE_PRICE_PLACEHOLDER = '—';
const TABLE_HINT = 'Tuščia kaina reiškia, kad variantas naudoja prekės kainą ir akcijos kainą.';
const REMOVE_ROW_LABEL = 'Ištrinti derinį';
const PRODUCT_GROUP_LABEL = 'Tik šiai prekei';
const SIZE_ADDED_MESSAGE = 'Dydis pridėtas. Jis matomas ir puslapyje Savybės.';
const ARCHIVE_LABEL = 'Archyvuoti variantą';
const UNDO_ARCHIVE_LABEL = 'Atšaukti archyvavimą';
const ARCHIVED_BADGE_LABEL = 'Bus archyvuotas';
const ARCHIVE_HINT =
  'Išsaugojus archyvuotas variantas nebeparduodamas ir dingsta iš lentelės; sugeneravus tą patį derinį jis grąžinamas.';
const BULK_EDIT_HINT = 'Tik užpildo laukelius. Išsaugoma kartu su preke.';
const QUICK_SELECT_PLACEHOLDER = 'Pažymėti pagal reikšmę';
const TICK_ALL_LABEL = 'Pažymėti visus variantus';
const TICK_ROW_LABEL = 'Pažymėti variantą';
const UNTICK_ALL_LABEL = 'Atžymėti visus';
const APPLY_TO_ALL_LABEL = 'Taikyti visiems';
const getApplyToTickedLabel = (tickedCount: number) => `Taikyti pažymėtiems (${tickedCount})`;
const EMPTY_BULK_INPUTS = {
  stockCount: '',
  price: '',
  salePrice: '',
  shouldClearPrice: false,
  shouldClearSalePrice: false,
};
const CLEAR_LABEL = 'Išvalyti';
const CLEAR_PRICE_HINT = 'Išvalo varianto kainą ir akcijos kainą: variantas naudos prekės kainas.';
const CLEAR_SALE_PRICE_HINT = 'Išvalo varianto akcijos kainą.';
const REPLACE_VARIANTS_TITLE = 'Pakeisti visus variantus?';
const REPLACE_VARIANTS_DESCRIPTION =
  'Pridėjus ar pašalinus savybę, visi esami variantai bus pakeisti naujais. Išsaugojus prekę, variantai su užsakymais bus archyvuoti, kiti ištrinti.';
const getRemoveValueTitle = (label: string) => `Pašalinti reikšmę „${label}“?`;
const getRemoveValueDescription = (rowCount: number) =>
  `Iš lentelės bus pašalinti visi jos variantai (${rowCount}). Išsaugojus prekę, variantai su užsakymais bus archyvuoti, kiti ištrinti.`;

export const VariantEditor = ({ storeGroups, onStoreGroupsChange, reservedCounts, isDisabled }: Props) => {
  const params = useParams();
  const form = useFormContext<ProductFormValues>();
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'variants',
    keyName: 'key',
  });
  const chosenGroups = useWatch({ control: form.control, name: 'optionGroups' });
  const productGroups = useWatch({ control: form.control, name: 'productGroups' });
  const variants = useWatch({ control: form.control, name: 'variants' });
  const [productPrice, productSalePrice] = useWatch({ control: form.control, name: ['price', 'salePrice'] });
  const [pendingGroups, setPendingGroups] = useState<ChosenGroup[] | null>(null);
  const [pendingValueRemoval, setPendingValueRemoval] = useState<PendingValueRemoval | null>(null);
  const [isAddingSize, setIsAddingSize] = useState(false);
  // Ticked rows by field key; keys of removed rows are ignored
  const [tickedKeys, setTickedKeys] = useState<ReadonlySet<string>>(new Set());

  const groupDefinitions = [
    ...storeGroups.map((group) => ({ ...group, kind: 'store' as const })),
    ...productGroups.map((group) => ({ ...group, kind: 'product' as const })),
  ] satisfies GroupDefinition[];
  const availableGroups = groupDefinitions.filter((group) => !chosenGroups.some(({ id }) => id === group.id));
  const canAddGroup = chosenGroups.length < MAX_OPTION_GROUP_COUNT;
  const missingCombinations = generateMissingCombinations({ groups: chosenGroups, variants });
  // Saved variants (the default one too) or generated rows would be lost, so a group change asks first
  const hasVariantsToReplace = variants.some(
    (variant) => variant.id !== undefined || variant.optionValueIds.length > 0,
  );
  const tableRows = fields.map(({ key, optionValueIds }, index) => ({
    key,
    optionValueIds,
    isArchived: variants.at(index)?.isArchived ?? false,
  }));
  // Rows marked for archiving can't be ticked or bulk-edited
  const activeRowKeys = tableRows.flatMap(({ key, isArchived }) => (isArchived ? [] : [key]));
  const tickedCount = activeRowKeys.filter((key) => tickedKeys.has(key)).length;
  const isEveryRowTicked = activeRowKeys.length > 0 && tickedCount === activeRowKeys.length;

  const getReservedCount = (variantId: string | undefined) =>
    variantId === undefined ? 0 : (reservedCounts[variantId] ?? 0);

  const findGroupDefinition = (groupId: string) => groupDefinitions.find(({ id }) => id === groupId);

  // "Spalva: Šalavijų", "Dydis: 0–6 mėn.": every value the product uses, in group order
  const quickSelectOptions = chosenGroups.flatMap((group) => {
    const definition = findGroupDefinition(group.id);

    if (!definition) {
      return [];
    }

    return definition.values
      .filter((value) => group.valueIds.includes(value.id))
      .map((value) => ({ id: value.id, label: `${definition.name}: ${value.label}` }));
  });

  const handleQuickSelect = (valueId: string) => {
    setTickedKeys(getKeysWithValue({ rows: tableRows, valueId }));
  };

  const handleTickAll = (isTicked: boolean) => {
    setTickedKeys(new Set(isTicked ? activeRowKeys : []));
  };

  const handleRowTick = (key: string, isTicked: boolean) => {
    setTickedKeys((keys) => {
      const nextKeys = new Set(keys);

      if (isTicked) {
        nextKeys.add(key);
      } else {
        nextKeys.delete(key);
      }

      return nextKeys;
    });
  };

  // Only fills the form fields; nothing is saved until the product is saved
  const handleBulkApply = (changes: BulkChanges) => {
    const options = { shouldDirty: true, shouldValidate: form.formState.isSubmitted };
    const targetIndexes = getBulkTargetIndexes({ rows: tableRows, tickedKeys });

    targetIndexes.forEach((index) => {
      if (changes.stockCount !== undefined) {
        form.setValue(`variants.${index}.stockCount`, changes.stockCount, options);
      }

      if (changes.price !== undefined) {
        form.setValue(`variants.${index}.price`, changes.price, options);
      }

      if (changes.salePrice !== undefined) {
        form.setValue(`variants.${index}.salePrice`, changes.salePrice, options);
      }
    });
  };

  // Changing the groups changes every combination, so the table starts over (after a confirmation if it has rows)
  const applyGroups = (groups: ChosenGroup[]) => {
    form.setValue('optionGroups', groups, { shouldDirty: true });
    replace(groups.length === 0 ? [EMPTY_DEFAULT_VARIANT] : []);
    setPendingGroups(null);
  };

  const handleGroupsChange = (groups: ChosenGroup[]) => {
    if (hasVariantsToReplace) {
      setPendingGroups(groups);
      return;
    }

    applyGroups(groups);
  };

  // A new product group lives only in the form until Save; the server replaces its temporary id
  const handleProductGroupCreate = (name: string) => {
    if (name.length === 0) {
      toast.error(GROUP_NAME_REQUIRED_MESSAGE);
      return false;
    }

    const productGroup = { id: crypto.randomUUID(), name, values: [] } satisfies ProductGroup;

    form.setValue('productGroups', [...productGroups, productGroup], { shouldDirty: true });
    handleGroupsChange([...chosenGroups, { id: productGroup.id, valueIds: [] }]);

    return true;
  };

  const handleProductValueCreate = (groupId: string, label: string) => {
    const productGroup = productGroups.find(({ id }) => id === groupId);

    if (!productGroup) {
      return false;
    }

    const message = getNewValueMessage(getLabels(productGroup.values), label);

    if (message) {
      toast.error(message);
      return false;
    }

    const value = { id: crypto.randomUUID(), label };
    const values = [...productGroup.values, value];

    form.setValue(
      'productGroups',
      productGroups.map((group) => (group.id === groupId ? { ...group, values } : group)),
      { shouldDirty: true },
    );
    pickValue({ groupId, valueId: value.id, values });

    return true;
  };

  // "+ Naujas dydis": saved right away as a store-level value of the size group, then picked for this product
  const handleSizeCreate = async (groupId: string, label: string) => {
    const sizeGroup = storeGroups.find(({ id }) => id === groupId);

    if (!sizeGroup) {
      return false;
    }

    const message = getNewValueMessage(getLabels(sizeGroup.values), label);

    if (message) {
      toast.error(message);
      return false;
    }

    try {
      setIsAddingSize(true);
      const response = await axios.post<OptionValue>(`/api/${params?.storeId}/option-groups/${groupId}/values`, {
        label,
      });
      const value = { id: response.data.id, label: response.data.label };
      const values = [...sizeGroup.values, value];

      onStoreGroupsChange((groups) => groups.map((group) => (group.id === groupId ? { ...group, values } : group)));
      pickValue({ groupId, valueId: value.id, values });
      toast.success(SIZE_ADDED_MESSAGE);

      return true;
    } catch (error) {
      toast.error(getFormErrorMessage(error));

      return false;
    } finally {
      setIsAddingSize(false);
    }
  };

  const handleValueToggle = (groupId: string, valueId: string) => {
    const group = chosenGroups.find(({ id }) => id === groupId);
    const definition = findGroupDefinition(groupId);

    if (!group || !definition) {
      return;
    }

    if (!group.valueIds.includes(valueId)) {
      pickValue({ groupId, valueId, values: definition.values });
      return;
    }

    const rows = variants.filter((variant) => variant.optionValueIds.includes(valueId));
    const hasRowsWorthKeeping = rows.some((variant) => variant.id !== undefined || Number(variant.stockCount) > 0);

    if (!hasRowsWorthKeeping) {
      removeValue({ groupId, valueId });
      return;
    }

    const label = definition.values.find(({ id }) => id === valueId)?.label ?? '';

    setPendingValueRemoval({ groupId, valueId, label, rowCount: rows.length });
  };

  const removeValue = ({ groupId, valueId }: Pick<PendingValueRemoval, 'groupId' | 'valueId'>) => {
    const rowIndexes = form
      .getValues('variants')
      .flatMap((variant, index) => (variant.optionValueIds.includes(valueId) ? [index] : []));
    const group = form.getValues('optionGroups').find(({ id }) => id === groupId);

    remove(rowIndexes);
    setPendingValueRemoval(null);

    if (group) {
      setGroupValueIds(
        groupId,
        group.valueIds.filter((id) => id !== valueId),
      );
    }
  };

  const handleEnterKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault();
    }
  };

  // Keeps the group's own value order
  const pickValue = ({ groupId, valueId, values }: { groupId: string; valueId: string; values: OptionValue[] }) => {
    const group = form.getValues('optionGroups').find(({ id }) => id === groupId);

    if (!group) {
      return;
    }

    setGroupValueIds(
      groupId,
      values.flatMap(({ id }) => (id === valueId || group.valueIds.includes(id) ? [id] : [])),
    );
  };

  // Reads the current groups, not the render's, so it also works right after an awaited request
  const setGroupValueIds = (groupId: string, valueIds: string[]) => {
    form.setValue(
      'optionGroups',
      form.getValues('optionGroups').map((group) => (group.id === groupId ? { ...group, valueIds } : group)),
      { shouldDirty: true },
    );
  };

  const handleGenerate = () => {
    append(missingCombinations.map((optionValueIds) => ({ ...EMPTY_DEFAULT_VARIANT, optionValueIds })));
  };

  const getRowLabel = (variant: Pick<VariantRow, 'optionValueIds'>) =>
    chosenGroups
      .flatMap(({ id }) => {
        const value = findGroupDefinition(id)?.values.find((option) => variant.optionValueIds.includes(option.id));

        return value ? [value.label] : [];
      })
      .join(VALUE_SEPARATOR);

  const variantColumnLabel = chosenGroups
    .flatMap(({ id }) => {
      const definition = findGroupDefinition(id);

      return definition ? [definition.name] : [];
    })
    .join(VALUE_SEPARATOR);
  const inheritedPrices = {
    price: formatInheritedPrice(productPrice) ?? INHERITED_PRICE_FALLBACK,
    salePrice: formatInheritedPrice(productSalePrice) ?? NO_SALE_PRICE_PLACEHOLDER,
  };
  const hasArchivedRows = tableRows.some(({ isArchived }) => isArchived);

  const getAddValueControl = (definition: GroupDefinition) => {
    if (definition.kind === 'product') {
      return (
        <AddTextInput
          placeholder="Nauja reikšmė"
          actionLabel="Pridėti reikšmę"
          isDisabled={isDisabled}
          onAdd={(label) => handleProductValueCreate(definition.id, label)}
        />
      );
    }

    if (definition.role === 'SIZE') {
      return (
        <AddTextInput
          placeholder="Pvz. 6–9 mėn."
          actionLabel="Naujas dydis"
          isDisabled={isDisabled || isAddingSize}
          onAdd={(label) => handleSizeCreate(definition.id, label)}
        />
      );
    }

    return null;
  };

  return (
    <>
      <AlertModal
        isOpen={pendingGroups !== null}
        onClose={() => setPendingGroups(null)}
        onConfirm={() => pendingGroups && applyGroups(pendingGroups)}
        loading={isDisabled}
        title={REPLACE_VARIANTS_TITLE}
        description={REPLACE_VARIANTS_DESCRIPTION}
      />

      <AlertModal
        isOpen={pendingValueRemoval !== null}
        onClose={() => setPendingValueRemoval(null)}
        onConfirm={() => pendingValueRemoval && removeValue(pendingValueRemoval)}
        loading={isDisabled}
        title={pendingValueRemoval ? getRemoveValueTitle(pendingValueRemoval.label) : undefined}
        description={pendingValueRemoval ? getRemoveValueDescription(pendingValueRemoval.rowCount) : undefined}
      />

      <div className="space-y-4" onKeyDown={handleEnterKey}>
        {storeGroups.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Bendrų savybių dar nėra. Jas galima sukurti puslapyje
            <Link href={`/${params?.storeId}/option-groups`} className="ml-1 text-blue-500 underline">
              Savybės
            </Link>
            .
          </p>
        )}

        {chosenGroups.map((group) => {
          const definition = findGroupDefinition(group.id);

          if (!definition) {
            return null;
          }

          return (
            <ChosenGroupCard
              key={group.id}
              group={group}
              definition={definition}
              isDisabled={isDisabled}
              onValueToggle={(valueId) => handleValueToggle(group.id, valueId)}
              onRemove={() => handleGroupsChange(chosenGroups.filter(({ id }) => id !== group.id))}
            >
              {getAddValueControl(definition)}
            </ChosenGroupCard>
          );
        })}

        <div className="flex flex-wrap items-center gap-3">
          {availableGroups.length > 0 && (
            <Select
              value=""
              disabled={isDisabled || !canAddGroup}
              onValueChange={(groupId) => handleGroupsChange([...chosenGroups, { id: groupId, valueIds: [] }])}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Pridėti savybę" />
              </SelectTrigger>
              <SelectContent>
                {availableGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.kind === 'product' ? `${group.name} (${PRODUCT_GROUP_LABEL.toLowerCase()})` : group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <AddTextInput
            placeholder="Prekės savybė, pvz. Stilius"
            actionLabel="Nauja prekės savybė"
            isDisabled={isDisabled || !canAddGroup}
            onAdd={handleProductGroupCreate}
          />

          {chosenGroups.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              disabled={isDisabled || missingCombinations.length === 0}
              onClick={handleGenerate}
            >
              Generuoti derinius
            </Button>
          )}

          <span className="text-muted-foreground text-sm">Daugiausia {MAX_OPTION_GROUP_COUNT} savybės prekei.</span>
        </div>

        {chosenGroups.length === 0 ? (
          <DefaultVariantFields isDisabled={isDisabled} reservedCount={getReservedCount(variants.at(0)?.id)} />
        ) : (
          <FormField
            control={form.control}
            name="variants"
            render={() => (
              <FormItem>
                {fields.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3">
                    <Select value="" disabled={isDisabled} onValueChange={handleQuickSelect}>
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder={QUICK_SELECT_PLACEHOLDER} />
                      </SelectTrigger>
                      <SelectContent>
                        {quickSelectOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {tickedCount > 0 && (
                      <Button type="button" variant="ghost" disabled={isDisabled} onClick={() => handleTickAll(false)}>
                        {UNTICK_ALL_LABEL}
                      </Button>
                    )}
                  </div>
                )}
                {fields.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Checkbox
                            checked={isEveryRowTicked}
                            disabled={isDisabled}
                            aria-label={TICK_ALL_LABEL}
                            onCheckedChange={(checked) => handleTickAll(checked === true)}
                          />
                        </TableHead>
                        <TableHead>{variantColumnLabel}</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Laisva</TableHead>
                        <TableHead>Rezervuota</TableHead>
                        <TableHead>Viso</TableHead>
                        <TableHead>Kaina</TableHead>
                        <TableHead>Akcijos kaina</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <BulkEditRow tickedCount={tickedCount} isDisabled={isDisabled} onApply={handleBulkApply} />
                      {fields.map((field, index) => (
                        <VariantTableRow
                          key={field.key}
                          index={index}
                          label={getRowLabel(field)}
                          reservedCount={getReservedCount(field.id)}
                          inheritedPrices={inheritedPrices}
                          isDisabled={isDisabled}
                          isSaved={field.id !== undefined}
                          isTicked={tickedKeys.has(field.key)}
                          onTickedChange={(isTicked) => handleRowTick(field.key, isTicked)}
                          onRemove={() => remove(index)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}
                {fields.length > 0 && <FormDescription>{TABLE_HINT}</FormDescription>}
                {hasArchivedRows && <FormDescription>{ARCHIVE_HINT}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    </>
  );
};

type ChosenGroupCardProps = {
  group: ChosenGroup;
  definition: GroupDefinition;
  isDisabled: boolean;
  onValueToggle: (valueId: string) => void;
  onRemove: () => void;
  // The group's add-value control, if it has one ("+ Naujas dydis", or a product group's new value)
  children?: ReactNode;
};

const ChosenGroupCard = ({
  group,
  definition,
  isDisabled,
  onValueToggle,
  onRemove,
  children,
}: ChosenGroupCardProps) => (
  <div className="space-y-3 rounded-md border p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="font-medium">{definition.name}</span>
        {definition.kind === 'product' && <Badge variant="secondary">{PRODUCT_GROUP_LABEL}</Badge>}
      </div>
      <Button type="button" variant="ghost" size="icon" disabled={isDisabled} onClick={onRemove}>
        <X className="h-4 w-4" />
        <span className="sr-only">Pašalinti savybę</span>
      </Button>
    </div>
    {definition.values.length === 0 && <p className="text-muted-foreground text-sm">Ši savybė dar neturi reikšmių.</p>}
    <div className="flex flex-wrap gap-2">
      {definition.values.map((value) => (
        <Button
          key={value.id}
          type="button"
          size="sm"
          variant={group.valueIds.includes(value.id) ? 'default' : 'outline'}
          disabled={isDisabled}
          onClick={() => onValueToggle(value.id)}
        >
          {value.label}
        </Button>
      ))}
    </div>
    {children}
  </div>
);

type AddTextInputProps = {
  placeholder: string;
  actionLabel: string;
  isDisabled: boolean;
  // Returns whether the text was added, so the input is cleared only then
  onAdd: (text: string) => boolean | Promise<boolean>;
};

// A text input with a "+" button inside the product form: Enter adds instead of submitting the form
const AddTextInput = ({ placeholder, actionLabel, isDisabled, onAdd }: AddTextInputProps) => {
  const [text, setText] = useState('');

  const handleAdd = async () => {
    const isAdded = await onAdd(text.trim());

    if (isAdded) {
      setText('');
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    void handleAdd();
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        className="w-56"
        value={text}
        placeholder={placeholder}
        disabled={isDisabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Button type="button" variant="outline" disabled={isDisabled} onClick={handleAdd}>
        <Plus className="h-4 w-4" />
        {actionLabel}
      </Button>
    </div>
  );
};

type VariantTableRowProps = {
  index: number;
  label: string;
  reservedCount: number;
  inheritedPrices: { price: string; salePrice: string };
  isDisabled: boolean;
  // Only a saved variant can be archived; a row that was never saved is simply deleted
  isSaved: boolean;
  isTicked: boolean;
  onTickedChange: (isTicked: boolean) => void;
  onRemove: () => void;
};

const VariantTableRow = ({
  index,
  label,
  reservedCount,
  inheritedPrices,
  isDisabled,
  isSaved,
  isTicked,
  onTickedChange,
  onRemove,
}: VariantTableRowProps) => {
  const form = useFormContext<ProductFormValues>();
  const price = useWatch({ control: form.control, name: `variants.${index}.price` });
  const hasOwnPrice = getOptionalNumericInput(price) !== null;
  const salePricePlaceholder = hasOwnPrice ? NO_SALE_PRICE_PLACEHOLDER : inheritedPrices.salePrice;
  const isArchived = useWatch({ control: form.control, name: `variants.${index}.isArchived` });
  const archiveToggleLabel = isArchived ? UNDO_ARCHIVE_LABEL : ARCHIVE_LABEL;
  const stockCount = useWatch({ control: form.control, name: `variants.${index}.stockCount` });

  // Archiving only marks the row; on Save the variant is archived and leaves the table
  const handleArchiveToggle = () => {
    form.setValue(`variants.${index}.isArchived`, !isArchived, { shouldDirty: true });
  };

  return (
    <TableRow className={cn(isArchived ? 'text-muted-foreground' : '')}>
      <TableCell>
        <Checkbox
          checked={isTicked && !isArchived}
          disabled={isDisabled || isArchived}
          aria-label={`${TICK_ROW_LABEL}: ${label}`}
          onCheckedChange={(checked) => onTickedChange(checked === true)}
        />
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {label}
          {isArchived && <Badge variant="secondary">{ARCHIVED_BADGE_LABEL}</Badge>}
        </div>
      </TableCell>
      <TableCell>
        <FormField
          control={form.control}
          name={`variants.${index}.sku`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input className={SKU_INPUT_CLASS} disabled={isDisabled} aria-label={`SKU: ${label}`} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell>
        <FormField
          control={form.control}
          name={`variants.${index}.stockCount`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input type="number" min="0" step="1" className={STOCK_INPUT_CLASS} disabled={isDisabled} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell>{reservedCount}</TableCell>
      <TableCell>{formatTotalStock(getVariantTotalStock({ stockCount, reservedCount }))}</TableCell>
      <TableCell>
        <PriceField name={`variants.${index}.price`} placeholder={inheritedPrices.price} isDisabled={isDisabled} />
      </TableCell>
      <TableCell>
        <PriceField name={`variants.${index}.salePrice`} placeholder={salePricePlaceholder} isDisabled={isDisabled} />
      </TableCell>
      <TableCell>
        {isSaved ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isDisabled}
            title={archiveToggleLabel}
            onClick={handleArchiveToggle}
          >
            {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            <span className="sr-only">{archiveToggleLabel}</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isDisabled}
            title={REMOVE_ROW_LABEL}
            onClick={onRemove}
          >
            <Trash className="h-4 w-4" />
            <span className="sr-only">{REMOVE_ROW_LABEL}</span>
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
};

type BulkEditRowProps = {
  // Ticked rows still in the table; 0 means the values go to every row
  tickedCount: number;
  isDisabled: boolean;
  onApply: (changes: BulkChanges) => void;
};

// "Taikyti visiems": fills Laisva, Kaina or Akcijos kaina in the ticked rows (or all rows); empty inputs are skipped,
// "Išvalyti" empties a price so the rows inherit the product's prices again
const BulkEditRow = ({ tickedCount, isDisabled, onApply }: BulkEditRowProps) => {
  const [inputs, setInputs] = useState(EMPTY_BULK_INPUTS);
  // Clearing the price clears the sale price too, so its input is locked
  const isSalePriceCleared = inputs.shouldClearPrice || inputs.shouldClearSalePrice;
  const rowLabel = tickedCount > 0 ? getApplyToTickedLabel(tickedCount) : APPLY_TO_ALL_LABEL;

  const handleApply = () => {
    const result = getBulkChanges(inputs);

    if (!result.isValid) {
      toast.error(result.message);
      return;
    }

    onApply(result.changes);
    setInputs(EMPTY_BULK_INPUTS);
  };

  // Enter applies instead of submitting the product form
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    handleApply();
  };

  const getInputProps = ({ name, isCleared }: { name: 'stockCount' | 'price' | 'salePrice'; isCleared: boolean }) => ({
    value: isCleared ? '' : inputs[name],
    disabled: isDisabled || isCleared,
    onKeyDown: handleKeyDown,
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      setInputs((current) => ({ ...current, [name]: event.target.value })),
  });

  return (
    <TableRow className="bg-muted/50 hover:bg-muted/50">
      <TableCell />
      <TableCell colSpan={2}>
        <p className="font-medium">{rowLabel}</p>
        <p className="text-muted-foreground text-xs">{BULK_EDIT_HINT}</p>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min="0"
          step="1"
          className={STOCK_INPUT_CLASS}
          placeholder="Laisva"
          aria-label={`${rowLabel}: Laisva`}
          {...getInputProps({ name: 'stockCount', isCleared: false })}
        />
      </TableCell>
      <TableCell />
      <TableCell />
      <TableCell>
        <Input
          type="number"
          min="0"
          step="0.01"
          className={PRICE_INPUT_CLASS}
          placeholder="Kaina"
          aria-label={`${rowLabel}: Kaina`}
          {...getInputProps({ name: 'price', isCleared: inputs.shouldClearPrice })}
        />
        <ClearToggle
          title={CLEAR_PRICE_HINT}
          isChecked={inputs.shouldClearPrice}
          isDisabled={isDisabled}
          onCheckedChange={(isChecked) => setInputs((current) => ({ ...current, shouldClearPrice: isChecked }))}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min="0"
          step="0.01"
          className={PRICE_INPUT_CLASS}
          placeholder="Akcijos kaina"
          aria-label={`${rowLabel}: Akcijos kaina`}
          {...getInputProps({ name: 'salePrice', isCleared: isSalePriceCleared })}
        />
        <ClearToggle
          title={CLEAR_SALE_PRICE_HINT}
          isChecked={isSalePriceCleared}
          isDisabled={isDisabled || inputs.shouldClearPrice}
          onCheckedChange={(isChecked) => setInputs((current) => ({ ...current, shouldClearSalePrice: isChecked }))}
        />
      </TableCell>
      <TableCell>
        <Button type="button" variant="secondary" size="sm" disabled={isDisabled} onClick={handleApply}>
          Taikyti
        </Button>
      </TableCell>
    </TableRow>
  );
};

type ClearToggleProps = {
  title: string;
  isChecked: boolean;
  isDisabled: boolean;
  onCheckedChange: (isChecked: boolean) => void;
};

const ClearToggle = ({ title, isChecked, isDisabled, onCheckedChange }: ClearToggleProps) => {
  const id = useId();

  return (
    <div className="mt-2 flex items-center gap-2" title={title}>
      <Checkbox
        id={id}
        checked={isChecked}
        disabled={isDisabled}
        onCheckedChange={(checked) => onCheckedChange(checked === true)}
      />
      <Label htmlFor={id} className="text-muted-foreground text-xs font-normal">
        {CLEAR_LABEL}
      </Label>
    </div>
  );
};

type PriceFieldProps = {
  name: `variants.${number}.price` | `variants.${number}.salePrice`;
  placeholder: string;
  isDisabled: boolean;
};

const PriceField = ({ name, placeholder, isDisabled }: PriceFieldProps) => {
  const form = useFormContext<ProductFormValues>();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Input
              type="number"
              min="0"
              step="0.01"
              className={PRICE_INPUT_CLASS}
              placeholder={placeholder}
              disabled={isDisabled}
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

type DefaultVariantFieldsProps = {
  reservedCount: number;
  isDisabled: boolean;
};

// A product without groups edits its default variant's SKU and Laisva only (no table, no price override)
const DefaultVariantFields = ({ reservedCount, isDisabled }: DefaultVariantFieldsProps) => {
  const form = useFormContext<ProductFormValues>();
  const stockCount = useWatch({ control: form.control, name: 'variants.0.stockCount' });
  const totalCount = getVariantTotalStock({ stockCount, reservedCount });

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <FormField
        control={form.control}
        name="variants.0.stockCount"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Laisva</FormLabel>
            <FormControl>
              <Input type="number" min="0" step="1" disabled={isDisabled} placeholder="9" {...field} />
            </FormControl>
            <FormDescription>{STOCK_HINT}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="variants.0.sku"
        render={({ field }) => (
          <FormItem>
            <FormLabel>SKU</FormLabel>
            <FormControl>
              <Input disabled={isDisabled} placeholder="BS-0001" {...field} />
            </FormControl>
            <FormDescription>Neprivaloma. Turi būti unikalus parduotuvėje.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <ReadOnlyStockField label="Rezervuota" value={reservedCount} hint={RESERVED_HINT} />
      <ReadOnlyStockField label="Viso" value={formatTotalStock(totalCount)} hint={TOTAL_HINT} />
    </div>
  );
};

type ReadOnlyStockFieldProps = {
  label: string;
  value: number | string;
  hint: string;
};

const ReadOnlyStockField = ({ label, value, hint }: ReadOnlyStockFieldProps) => {
  const id = useId();

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} readOnly disabled />
      <p className="text-muted-foreground text-sm">{hint}</p>
    </div>
  );
};

const formatTotalStock = (totalCount: number | null) => totalCount ?? NO_TOTAL_PLACEHOLDER;

const getLabels = (values: OptionValue[]) => values.map(({ label }) => label);

const formatInheritedPrice = (value: string | number | null | undefined) => {
  const price = getOptionalNumericInput(value);

  return price === null || price <= 0 ? null : formatter.format(price);
};
