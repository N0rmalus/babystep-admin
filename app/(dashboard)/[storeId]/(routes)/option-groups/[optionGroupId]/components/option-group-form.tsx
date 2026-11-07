'use client';

import axios from 'axios';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Plus, Trash } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form/form';
import { FormSection } from '@/components/ui/form/form-section';
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { getFormErrorMessage } from '@/lib/get-form-error-message';
import { OPTION_DISPLAY_TYPE_LABELS } from '@/lib/option-display-type-labels';
import { HEX_PLACEHOLDER, OPTION_DISPLAY_TYPES, isValidHexColour } from '@/lib/option-group';
import { optionGroupFormSchema, OptionGroupFormValues } from './schema';

type Props = {
  initialData: OptionGroupFormValues | null;
};

const EMPTY_VALUE = { label: '', hex: '', variantCount: 0 };
const DELETE_VALUE_LABEL = 'Ištrinti reikšmę';
const USED_VALUE_HINT = 'Reikšmę naudoja prekių variantai, todėl ją galima tik pervadinti';
const NEW_GROUP_VALUES: OptionGroupFormValues = { name: '', displayType: 'CHIPS', values: [] };

export const OptionGroupForm = ({ initialData }: Props) => {
  const params = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = initialData !== null;
  const title = isEditing ? 'Redaguoti savybę' : 'Sukurti naują savybę';
  const toastMessage = isEditing ? 'Savybė atnaujinta.' : 'Savybė sukurta.';
  const action = isEditing ? 'Išsaugoti pakeitimus' : 'Sukurti savybę';
  const listPath = `/${params?.storeId}/option-groups`;

  const form = useForm<OptionGroupFormValues>({
    resolver: zodResolver(optionGroupFormSchema),
    defaultValues: initialData ?? NEW_GROUP_VALUES,
  });
  const { fields, append, move, remove } = useFieldArray({ control: form.control, name: 'values' });
  const isSwatch = useWatch({ control: form.control, name: 'displayType' }) === 'SWATCH';

  const handleSubmit = async ({ name, displayType, values }: OptionGroupFormValues) => {
    const body = {
      name,
      displayType,
      values: values.map(({ valueId, label, hex }) => ({ id: valueId, label, hex: hex || null })),
    };

    try {
      setIsLoading(true);

      if (isEditing) {
        await axios.patch(`/api/${params?.storeId}/option-groups/${params?.optionGroupId}`, body);
      } else {
        await axios.post(`/api/${params?.storeId}/option-groups`, body);
      }

      router.refresh();
      router.push(listPath);
      toast.success(toastMessage);
    } catch (error) {
      toast.error(getFormErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Heading title={title} />
      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="w-full space-y-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <FormSection title="Pagrindinė informacija">
                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pavadinimas</FormLabel>
                        <FormControl>
                          <Input disabled={isLoading} placeholder="Pvz. Dydis" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="displayType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rodymas</FormLabel>
                        <Select disabled={isLoading} onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {OPTION_DISPLAY_TYPES.map((displayType) => (
                              <SelectItem key={displayType} value={displayType}>
                                {OPTION_DISPLAY_TYPE_LABELS[displayType]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              <FormSection
                title="Reikšmės"
                description={
                  isSwatch
                    ? 'Kiekvienai reikšmei reikia spalvos HEX kodo. Tvarka čia yra tvarka parduotuvėje.'
                    : 'Tvarka čia yra tvarka parduotuvėje.'
                }
              >
                {fields.length === 0 && <p className="text-muted-foreground text-sm">Reikšmių dar nėra.</p>}

                {fields.map((field, index) => {
                  const isUsed = field.variantCount > 0;

                  return (
                    <div key={field.id} className="flex items-start gap-2">
                      <div className="flex flex-col">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-8"
                          disabled={isLoading || index === 0}
                          onClick={() => move(index, index - 1)}
                          aria-label="Perkelti aukštyn"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-8"
                          disabled={isLoading || index === fields.length - 1}
                          onClick={() => move(index, index + 1)}
                          aria-label="Perkelti žemyn"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>

                      <FormField
                        control={form.control}
                        name={`values.${index}.label`}
                        render={({ field: labelField }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input disabled={isLoading} placeholder="Pvz. 0–6 mėn." {...labelField} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {isSwatch && (
                        <FormField
                          control={form.control}
                          name={`values.${index}.hex`}
                          render={({ field: hexField }) => (
                            <FormItem className="w-40">
                              <div className="flex items-center gap-2">
                                <ColourPreview hex={hexField.value} />
                                <FormControl>
                                  <Input disabled={isLoading} placeholder={HEX_PLACEHOLDER} {...hexField} />
                                </FormControl>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={isLoading || isUsed}
                        onClick={() => remove(index)}
                        aria-label={DELETE_VALUE_LABEL}
                        title={isUsed ? USED_VALUE_HINT : DELETE_VALUE_LABEL}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}

                <Button type="button" variant="outline" disabled={isLoading} onClick={() => append(EMPTY_VALUE)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Pridėti reikšmę
                </Button>
              </FormSection>
            </div>

            <div className="xl:sticky xl:top-6 xl:h-fit">
              <FormSection>
                <Button disabled={isLoading} className="w-full" type="submit">
                  {isLoading ? 'Saugoma...' : action}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  className="w-full"
                  onClick={() => router.push(listPath)}
                >
                  Atšaukti
                </Button>
              </FormSection>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
};

type ColourPreviewProps = {
  hex: string;
};

const ColourPreview = ({ hex }: ColourPreviewProps) => {
  return (
    <span
      aria-hidden
      className="h-9 w-9 shrink-0 rounded-full border"
      style={isValidHexColour(hex) ? { backgroundColor: hex } : undefined}
    />
  );
};
