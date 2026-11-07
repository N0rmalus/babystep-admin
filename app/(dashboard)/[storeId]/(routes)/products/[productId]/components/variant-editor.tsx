'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { Trash, X } from 'lucide-react';
import { AlertModal } from '@/components/modals/alert-modal';
import { Button } from '@/components/ui/button';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getVariantLabel } from '@/lib/variant-label';
import { generateMissingCombinations, MAX_OPTION_GROUP_COUNT } from '@/lib/variant-plan';
import { EMPTY_DEFAULT_VARIANT, ProductFormValues, VariantRow } from './schema';

export type StoreOptionGroup = {
  id: string;
  name: string;
  // Values in group order
  values: { id: string; label: string }[];
};

type Props = {
  storeGroups: StoreOptionGroup[];
  isDisabled: boolean;
};

type ChosenGroup = ProductFormValues['optionGroups'][number];

const STOCK_HINT = 'Įveskite laisvą kiekį, be rezervuotų.';
// Reserved stock arrives with the Montonio checkout (step 3); until then nothing is reserved
const RESERVED_STOCK_COUNT = 0;
const STOCK_INPUT_CLASS = 'w-24';
const PRICE_INPUT_CLASS = 'w-28';

export const VariantEditor = ({ storeGroups, isDisabled }: Props) => {
  const params = useParams();
  const form = useFormContext<ProductFormValues>();
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'variants',
    keyName: 'key',
  });
  const chosenGroups = useWatch({ control: form.control, name: 'optionGroups' });
  const variants = useWatch({ control: form.control, name: 'variants' });
  const [pendingGroups, setPendingGroups] = useState<ChosenGroup[] | null>(null);

  const availableGroups = storeGroups.filter((group) => !chosenGroups.some(({ id }) => id === group.id));
  const canAddGroup = chosenGroups.length < MAX_OPTION_GROUP_COUNT && availableGroups.length > 0;
  const missingCombinations = generateMissingCombinations({ groups: chosenGroups, variants });
  const hasOptionVariants = variants.some((variant) => variant.optionValueIds.length > 0);

  // Changing the groups changes every combination, so the table starts over (after a confirmation if it has rows)
  const applyGroups = (groups: ChosenGroup[]) => {
    form.setValue('optionGroups', groups, { shouldDirty: true });
    replace(groups.length === 0 ? [EMPTY_DEFAULT_VARIANT] : []);
    setPendingGroups(null);
  };

  const handleGroupsChange = (groups: ChosenGroup[]) => {
    if (hasOptionVariants) {
      setPendingGroups(groups);
      return;
    }

    applyGroups(groups);
  };

  const handleValueToggle = (groupId: string, valueId: string) => {
    const group = chosenGroups.find(({ id }) => id === groupId);
    const storeGroup = storeGroups.find(({ id }) => id === groupId);

    if (!group || !storeGroup) {
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

    // Keep the group's own value order
    const valueIds = storeGroup.values.flatMap(({ id }) => (id === valueId || group.valueIds.includes(id) ? [id] : []));

    setGroupValueIds(groupId, valueIds);
  };

  const setGroupValueIds = (groupId: string, valueIds: string[]) => {
    form.setValue(
      'optionGroups',
      chosenGroups.map((group) => (group.id === groupId ? { ...group, valueIds } : group)),
      { shouldDirty: true },
    );
  };

  const handleGenerate = () => {
    append(missingCombinations.map((optionValueIds) => ({ ...EMPTY_DEFAULT_VARIANT, optionValueIds })));
  };

  const getRowLabel = (variant: Pick<VariantRow, 'optionValueIds'>) => {
    const options = chosenGroups.flatMap(({ id }) => {
      const storeGroup = storeGroups.find((group) => group.id === id);
      const value = storeGroup?.values.find((option) => variant.optionValueIds.includes(option.id));

      return storeGroup && value ? [{ name: storeGroup.name, value: value.label }] : [];
    });

    return getVariantLabel(options);
  };

  return (
    <>
      <AlertModal
        isOpen={pendingGroups !== null}
        onClose={() => setPendingGroups(null)}
        onConfirm={() => pendingGroups && applyGroups(pendingGroups)}
        loading={isDisabled}
      />

      <div className="space-y-4">
        {storeGroups.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Savybių dar nėra. Jas galima sukurti puslapyje
            <Link href={`/${params?.storeId}/option-groups`} className="ml-1 text-blue-500 underline">
              Savybės
            </Link>
            .
          </p>
        )}

        {chosenGroups.map((group) => (
          <ChosenGroupCard
            key={group.id}
            group={group}
            storeGroup={storeGroups.find(({ id }) => id === group.id)}
            isDisabled={isDisabled}
            onValueToggle={(valueId) => handleValueToggle(group.id, valueId)}
            onRemove={() => handleGroupsChange(chosenGroups.filter(({ id }) => id !== group.id))}
          />
        ))}

        {storeGroups.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
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
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
        )}

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
                          onRemove={() => remove(index)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}
                <FormDescription>
                  {STOCK_HINT} Tuščia kaina reiškia, kad variantas naudoja prekės kainą ir akcijos kainą.
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
  storeGroup: StoreOptionGroup | undefined;
  isDisabled: boolean;
  onValueToggle: (valueId: string) => void;
  onRemove: () => void;
};

const ChosenGroupCard = ({ group, storeGroup, isDisabled, onValueToggle, onRemove }: ChosenGroupCardProps) => (
  <div className="space-y-3 rounded-md border p-4">
    <div className="flex items-center justify-between">
      <span className="font-medium">{storeGroup?.name}</span>
      <Button type="button" variant="ghost" size="icon" disabled={isDisabled} onClick={onRemove}>
        <X className="h-4 w-4" />
        <span className="sr-only">Pašalinti savybę</span>
      </Button>
    </div>
    {storeGroup && storeGroup.values.length === 0 && (
      <p className="text-muted-foreground text-sm">Ši savybė dar neturi reikšmių.</p>
    )}
    <div className="flex flex-wrap gap-2">
      {storeGroup?.values.map((value) => (
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
  </div>
);

type VariantTableRowProps = {
  index: number;
  label: string;
  isDisabled: boolean;
  onRemove: () => void;
};

const VariantTableRow = ({ index, label, isDisabled, onRemove }: VariantTableRowProps) => {
  const form = useFormContext<ProductFormValues>();
  const stockCount = Number(useWatch({ control: form.control, name: `variants.${index}.stockCount` })) || 0;

  return (
    <TableRow>
      <TableCell className="font-medium">{label}</TableCell>
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
        <Button type="button" variant="ghost" size="icon" disabled={isDisabled} onClick={onRemove}>
          <Trash className="h-4 w-4" />
          <span className="sr-only">Ištrinti derinį</span>
        </Button>
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
