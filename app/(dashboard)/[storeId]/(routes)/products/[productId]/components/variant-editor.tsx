'use client';

import axios from 'axios';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { KeyboardEvent, ReactNode, useState } from 'react';
import { useParams } from 'next/navigation';
import type { OptionGroupRole } from '@prisma/client';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Archive, ArchiveRestore, Plus, Trash, X } from 'lucide-react';
import { AlertModal } from '@/components/modals/alert-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { getFormErrorMessage } from '@/lib/get-form-error-message';
import { getNewValueMessage } from '@/lib/option-group';
import { GROUP_NAME_REQUIRED_MESSAGE } from '@/lib/product-groups';
import { getVariantLabel } from '@/lib/variant-label';
import { generateMissingCombinations, MAX_OPTION_GROUP_COUNT } from '@/lib/variant-plan';
import { EMPTY_DEFAULT_VARIANT, ProductFormValues, ProductGroup, VariantRow } from './schema';

type OptionValue = { id: string; label: string };

export type StoreOptionGroup = {
  id: string;
  name: string;
  role: OptionGroupRole;
  // Values in group order
  values: OptionValue[];
};

type Props = {
  storeGroups: StoreOptionGroup[];
  isDisabled: boolean;
};

type ChosenGroup = ProductFormValues['optionGroups'][number];

// A group the product can choose: a store-level group (Savybės) or one of its own product groups
type GroupDefinition = ({ kind: 'store'; role: OptionGroupRole } | { kind: 'product' }) & {
  id: string;
  name: string;
  values: OptionValue[];
};

const STOCK_HINT = 'Įveskite laisvą kiekį, be rezervuotų.';
// Reserved stock arrives with the Montonio checkout (step 3); until then nothing is reserved
const RESERVED_STOCK_COUNT = 0;
const STOCK_INPUT_CLASS = 'w-24';
const PRICE_INPUT_CLASS = 'w-28';
const PRODUCT_GROUP_LABEL = 'Tik šiai prekei';
const SIZE_ADDED_MESSAGE = 'Dydis pridėtas. Jis matomas ir puslapyje Savybės.';
const ARCHIVE_LABEL = 'Archyvuoti variantą';
const UNDO_ARCHIVE_LABEL = 'Atšaukti archyvavimą';
const ARCHIVED_BADGE_LABEL = 'Bus archyvuotas';
const ARCHIVE_HINT =
  'Išsaugojus archyvuotas variantas nebeparduodamas ir dingsta iš lentelės; sugeneravus tą patį derinį jis grąžinamas. Ištrintas variantas su užsakymais archyvuojamas.';
const REPLACE_VARIANTS_TITLE = 'Pakeisti visus variantus?';
const REPLACE_VARIANTS_DESCRIPTION =
  'Pridėjus ar pašalinus savybę, visi esami variantai bus pakeisti naujais. Išsaugojus prekę, variantai su užsakymais bus archyvuoti, kiti ištrinti.';

export const VariantEditor = ({ storeGroups: initialStoreGroups, isDisabled }: Props) => {
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
  const [pendingGroups, setPendingGroups] = useState<ChosenGroup[] | null>(null);
  // Sizes added with "+ Naujas dydis" are saved at once, so they join the store-level groups here
  const [storeGroups, setStoreGroups] = useState(initialStoreGroups);
  const [isAddingSize, setIsAddingSize] = useState(false);

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

  const findGroupDefinition = (groupId: string) => groupDefinitions.find(({ id }) => id === groupId);

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

      setStoreGroups((groups) => groups.map((group) => (group.id === groupId ? { ...group, values } : group)));
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

    if (group.valueIds.includes(valueId)) {
      const rowIndexes = variants.flatMap((variant, index) =>
        variant.optionValueIds.includes(valueId) ? [index] : [],
      );

      remove(rowIndexes);
      setGroupValueIds(
        groupId,
        group.valueIds.filter((id) => id !== valueId),
      );
      return;
    }

    pickValue({ groupId, valueId, values: definition.values });
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

  const getRowLabel = (variant: Pick<VariantRow, 'optionValueIds'>) => {
    const options = chosenGroups.flatMap(({ id }) => {
      const definition = findGroupDefinition(id);
      const value = definition?.values.find((option) => variant.optionValueIds.includes(option.id));

      return definition && value ? [{ name: definition.name, value: value.label }] : [];
    });

    return getVariantLabel(options);
  };

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

      <div className="space-y-4">
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
          <DefaultVariantFields isDisabled={isDisabled} />
        ) : (
          <FormField
            control={form.control}
            name="variants"
            render={() => (
              <FormItem>
                {fields.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Variantas</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead title={STOCK_HINT}>Laisva</TableHead>
                        <TableHead>Rezervuota</TableHead>
                        <TableHead>Viso</TableHead>
                        <TableHead>Kaina</TableHead>
                        <TableHead>Akcijos kaina</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => (
                        <VariantTableRow
                          key={field.key}
                          index={index}
                          label={getRowLabel(field)}
                          isDisabled={isDisabled}
                          isSaved={field.id !== undefined}
                          onRemove={() => remove(index)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}
                <FormDescription>
                  {STOCK_HINT} Tuščia kaina reiškia, kad variantas naudoja prekės kainą ir akcijos kainą. {ARCHIVE_HINT}
                </FormDescription>
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
  isDisabled: boolean;
  // Only a saved variant can be archived; a row that was never saved is simply deleted
  isSaved: boolean;
  onRemove: () => void;
};

const VariantTableRow = ({ index, label, isDisabled, isSaved, onRemove }: VariantTableRowProps) => {
  const form = useFormContext<ProductFormValues>();
  const stockCount = Number(useWatch({ control: form.control, name: `variants.${index}.stockCount` })) || 0;
  const isArchived = useWatch({ control: form.control, name: `variants.${index}.isArchived` });
  const archiveToggleLabel = isArchived ? UNDO_ARCHIVE_LABEL : ARCHIVE_LABEL;

  // Archiving only marks the row; on Save the variant is archived and leaves the table
  const handleArchiveToggle = () => {
    form.setValue(`variants.${index}.isArchived`, !isArchived, { shouldDirty: true });
  };

  return (
    <TableRow className={cn(isArchived ? 'text-muted-foreground' : '')}>
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
                <Input disabled={isDisabled} placeholder="BS-0001" {...field} />
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
                <Input
                  type="number"
                  min="0"
                  step="1"
                  className={STOCK_INPUT_CLASS}
                  title={STOCK_HINT}
                  disabled={isDisabled}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </TableCell>
      <TableCell className="text-muted-foreground">{RESERVED_STOCK_COUNT}</TableCell>
      <TableCell className="text-muted-foreground">{stockCount + RESERVED_STOCK_COUNT}</TableCell>
      <TableCell>
        <PriceField name={`variants.${index}.price`} placeholder="Prekės" isDisabled={isDisabled} />
      </TableCell>
      <TableCell>
        <PriceField name={`variants.${index}.salePrice`} placeholder="—" isDisabled={isDisabled} />
      </TableCell>
      <TableCell>
        <div className="flex items-center">
          {isSaved && (
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
          )}
          <Button type="button" variant="ghost" size="icon" disabled={isDisabled} onClick={onRemove}>
            <Trash className="h-4 w-4" />
            <span className="sr-only">Ištrinti derinį</span>
          </Button>
        </div>
      </TableCell>
    </TableRow>
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

// A product without groups edits its default variant's SKU and Laisva only (no table, no price override)
const DefaultVariantFields = ({ isDisabled }: Pick<Props, 'isDisabled'>) => {
  const form = useFormContext<ProductFormValues>();

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
    </div>
  );
};

const getLabels = (values: OptionValue[]) => values.map(({ label }) => label);
