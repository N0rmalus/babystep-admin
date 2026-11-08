'use client';

import toast from 'react-hot-toast';
import { useState } from 'react';
import { Category, Image, Product, Subcategory } from '@prisma/client';
import { Trash } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useRouter } from 'next/navigation';
import { AlertModal } from '@/components/modals/alert-modal';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form/form';
import { Heading } from '@/components/ui/heading';
import ImageUpload from '@/components/ui/image-upload';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TiptapEditor } from '@/components/ui/tiptap-editor';
import { getFormErrorMessage } from '@/lib/get-form-error-message';
import { getImageTagOptions } from '@/lib/product-images';
import { normalizeRichTextContent } from '@/lib/rich-text';
import { moveItem } from '@/lib/utils';
import { ProductStatusToggle } from './product-status-toggle';
import { FormSection } from '@/components/ui/form/form-section';
import {
  EMPTY_DEFAULT_VARIANT,
  productFormSchema,
  ProductFormValues,
  toVariantPayload,
} from '@/app/(dashboard)/[storeId]/(routes)/products/[productId]/components/schema';
import { ImageTagSelect } from './image-tag-select';
import { StoreOptionGroup, VariantEditor } from './variant-editor';
import Link from 'next/link';
import axios from 'axios';

type Props = {
  initialData:
    | (Omit<Product, 'price' | 'salePrice' | 'saleStartsAt' | 'saleEndsAt'> & {
        price: number;
        salePrice: number | null;
        saleStartsAt: string | null;
        saleEndsAt: string | null;
        images: Image[];
        optionGroups: ProductFormValues['optionGroups'];
        productGroups: ProductFormValues['productGroups'];
        variants: ProductFormValues['variants'];
      })
    | null;
  subcategories: Subcategory[];
  categories: Category[];
  storeGroups: StoreOptionGroup[];
};

const formatDateTimeLocalValue = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return localDate.toISOString().slice(0, 16);
};

export const ProductForm = ({ initialData, subcategories, categories, storeGroups: initialStoreGroups }: Props) => {
  const params = useParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // Lifted from the variant editor so image tags can label sizes added with "+ Naujas dydis"
  const [storeGroups, setStoreGroups] = useState(initialStoreGroups);
  const title = initialData ? 'Redaguoti prekę' : 'Sukurti naują prekę';
  const toastMessage = initialData ? 'Prekė atnaujinta.' : 'Prekė sukurta.';
  const action = initialData ? 'Išsaugoti pakeitimus' : 'Sukurti prekę';

  const defaultValues: ProductFormValues = initialData
    ? {
        name: initialData.name,
        images: initialData.images.map(({ id, url, optionValueId }) => ({ id, url, optionValueId })),
        price: initialData.price,
        salePrice: initialData.salePrice,
        saleStartsAt: formatDateTimeLocalValue(initialData.saleStartsAt),
        saleEndsAt: formatDateTimeLocalValue(initialData.saleEndsAt),
        optionGroups: initialData.optionGroups,
        productGroups: initialData.productGroups,
        variants: initialData.variants,
        subcategoryId: initialData.subcategoryId,
        isFeatured: initialData.isFeatured,
        isArchived: initialData.isArchived,
        description: normalizeRichTextContent(initialData.description),
      }
    : {
        name: '',
        images: [],
        price: 0,
        salePrice: null,
        saleStartsAt: null,
        saleEndsAt: null,
        optionGroups: [],
        productGroups: [],
        variants: [EMPTY_DEFAULT_VARIANT],
        subcategoryId: '',
        description: '',
        isFeatured: false,
        isArchived: false,
      };

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });

  const getTagOptions = ({
    optionGroups,
    productGroups,
    variants,
  }: Pick<ProductFormValues, 'optionGroups' | 'productGroups' | 'variants'>) => {
    const groupDefinitions = [...storeGroups, ...productGroups];
    const groups = optionGroups.flatMap(({ id }) => groupDefinitions.filter((group) => group.id === id));

    return getImageTagOptions({ groups, variants });
  };

  const handleSubmit = async ({ optionGroups, productGroups, variants, images, ...data }: ProductFormValues) => {
    // A tag on a value the variants no longer use (removed in the variant editor) is dropped, not rejected
    const tagIds = new Set(getTagOptions({ optionGroups, productGroups, variants }).map(({ id }) => id));
    const payload = {
      ...data,
      images: images.map((image) => ({
        ...image,
        optionValueId: image.optionValueId && tagIds.has(image.optionValueId) ? image.optionValueId : null,
      })),
      ...toVariantPayload({ optionGroups, productGroups, variants }),
      saleStartsAt: data.saleStartsAt || null,
      saleEndsAt: data.saleEndsAt || null,
    };

    try {
      setLoading(true);
      if (initialData) {
        await axios.patch(`/api/${params?.storeId}/products/${params?.productId}`, payload);
      } else {
        await axios.post(`/api/${params?.storeId}/products`, payload);
      }
      router.refresh();
      router.push(`/${params?.storeId}/products`);
      toast.success(toastMessage);
    } catch (error) {
      toast.error(getFormErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    try {
      setLoading(true);
      await axios.delete(`/api/${params?.storeId}/products/${params?.productId}`);
      router.refresh();
      router.push(`/${params?.storeId}/products`);
      toast.success('Prekė panaikinta.');
    } catch (error) {
      toast.error(getFormErrorMessage(error));
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const watchedImages = form.watch('images') ?? [];
  const watchedOptionGroups = useWatch({ control: form.control, name: 'optionGroups' });
  const watchedProductGroups = useWatch({ control: form.control, name: 'productGroups' });
  const watchedVariants = useWatch({ control: form.control, name: 'variants' });
  const tagOptions = getTagOptions({
    optionGroups: watchedOptionGroups,
    productGroups: watchedProductGroups,
    variants: watchedVariants,
  });
  const hasSubcategories = subcategories.length > 0;
  const submitDisabled = loading || !hasSubcategories;

  return (
    <>
      <AlertModal isOpen={open} onClose={() => setOpen(false)} onConfirm={onDelete} loading={loading} />

      <div className="flex items-center justify-between">
        <Heading title={title} />
        {initialData && (
          <Button type="button" disabled={loading} variant="destructive" size="icon" onClick={() => setOpen(true)}>
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="w-full space-y-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <FormSection
                title="Nuotraukos"
                description="Pirmoji nuotrauka bus produkto miniatiūra. Nuotrauką galite pažymėti viena variantų reikšme (pvz. Spalva: Avižų)."
              >
                <FormField
                  control={form.control}
                  name="images"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <ImageUpload
                          value={field.value.map((image) => image.url)}
                          disabled={loading}
                          onChange={(url) => {
                            const currentImages = form.getValues('images') ?? [];
                            field.onChange([...currentImages, { url }]);
                          }}
                          onRemove={(url) => {
                            const currentImages = form.getValues('images') ?? [];
                            field.onChange(currentImages.filter((current) => current.url !== url));
                          }}
                          onMove={(move) => field.onChange(moveItem(form.getValues('images') ?? [], move))}
                          renderImageFooter={(index) =>
                            tagOptions.length > 0 && (
                              <ImageTagSelect
                                options={tagOptions}
                                value={field.value.at(index)?.optionValueId ?? null}
                                isDisabled={loading}
                                onChange={(optionValueId) =>
                                  field.onChange(
                                    field.value.map((image, imageIndex) =>
                                      imageIndex === index ? { ...image, optionValueId } : image,
                                    ),
                                  )
                                }
                              />
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Įkeltos nuotraukos: <span className="text-foreground font-medium">{watchedImages.length}</span>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>

              <FormSection title="Pagrindinė informacija">
                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pavadinimas</FormLabel>
                        <FormControl>
                          <Input maxLength={191} disabled={loading} placeholder="Prekės pavadinimas" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subcategoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subkategorija</FormLabel>
                        <Select
                          disabled={loading || !hasSubcategories}
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  hasSubcategories ? 'Pasirinkite subkategoriją' : 'Pirma sukurkite subkategoriją'
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {subcategories.map((subcategory) => (
                              <SelectItem key={subcategory.id} value={subcategory.id}>
                                {subcategory.name} (Kategorija:{' '}
                                {categories.find((category) => category.id === subcategory.categoryId)?.name})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!hasSubcategories && (
                          <FormDescription>
                            Pirma sukurkite bent vieną
                            <Link
                              href={`/${params?.storeId}/subcategories/new`}
                              className="ml-1 text-blue-500 underline"
                            >
                              subkategoriją
                            </Link>
                            , kad būtų galima išsaugoti prekę.
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kaina</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="0.01" disabled={loading} placeholder="9.99" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="salePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Akcijos kaina</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={loading}
                            placeholder="7.99"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormDescription>Palik tuščią, jei prekė neturi akcijos.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="saleStartsAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Akcijos pradžia</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" disabled={loading} {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormDescription>Neprivaloma. Jei tuščia, akcija prasideda iš karto.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="saleEndsAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Akcijos pabaiga</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" disabled={loading} {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormDescription>Neprivaloma. Jei tuščia, akcija veikia be pabaigos datos.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <h3 className="text-base font-semibold tracking-tight">Produkto aprašymas</h3>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <TiptapEditor
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={loading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>

              <FormSection
                title="Variantai"
                description="Pasirinkite savybes (arba sukurkite šios prekės savybę) ir jų reikšmes, tada sugeneruokite derinius. Neegzistuojančius derinius ištrinkite."
              >
                <VariantEditor storeGroups={storeGroups} onStoreGroupsChange={setStoreGroups} isDisabled={loading} />
              </FormSection>
            </div>

            <div className="flex flex-col gap-6 xl:sticky xl:top-6 xl:h-fit">
              <FormSection title="Būsena" description="Nustatymai, kurie keičia produkto matomumą.">
                <FormField
                  control={form.control}
                  name="isFeatured"
                  render={({ field }) => (
                    <FormItem>
                      <ProductStatusToggle
                        label="Rekomenduojama"
                        description="Produktas bus rodomas pagrindiniame puslapyje."
                        checked={Boolean(field.value)}
                        disabled={loading}
                        onCheckedChange={field.onChange}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isArchived"
                  render={({ field }) => (
                    <FormItem>
                      <ProductStatusToggle
                        label="Archyvuota"
                        description="Archyvuotos prekės nerodomos pirkėjams, bet lieka administravimo sistemoje."
                        checked={Boolean(field.value)}
                        disabled={loading}
                        onCheckedChange={field.onChange}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>

              <FormSection>
                <Button disabled={submitDisabled} className="w-full" type="submit">
                  {loading ? 'Saugoma...' : action}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  className="w-full"
                  onClick={() => router.push(`/${params?.storeId}/products`)}
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
