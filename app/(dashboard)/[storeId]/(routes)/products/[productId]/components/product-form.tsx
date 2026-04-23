'use client';

import toast from 'react-hot-toast';
import { useState } from 'react';
import { Category, Image, Product, Subcategory } from '@prisma/client';
import { Trash } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useRouter } from 'next/navigation';
import { AlertModal } from '@/components/modals/alert-modal';
import { Badge } from '@/components/ui/badge';
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
import { getPlainTextFromRichText, normalizeRichTextContent } from '@/lib/rich-text';
import { formatter } from '@/lib/utils';
import { ProductStatusToggle } from './product-status-toggle';
import { FormSection } from '@/components/ui/form/form-section';
import {
  productFormSchema,
  ProductFormValues,
} from '@/app/(dashboard)/[storeId]/(routes)/products/[productId]/components/schema';
import Link from 'next/link';
import axios from 'axios';

type Props = {
  initialData:
    | (Product & {
        images: Image[];
      })
    | null;
  subcategories: Subcategory[];
  categories: Category[];
};

export const ProductForm = ({ initialData, subcategories, categories }: Props) => {
  const params = useParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const title = initialData ? 'Redaguoti prekę' : 'Sukurti naują prekę';
  const toastMessage = initialData ? 'Prekė atnaujinta.' : 'Prekė sukurta.';
  const action = initialData ? 'Išsaugoti pakeitimus' : 'Sukurti prekę';

  const defaultValues: ProductFormValues = initialData
    ? {
        name: initialData.name,
        images: initialData.images.map((image) => ({ url: image.url })),
        price: Number(initialData.price),
        amountInStock: initialData.amountInStock,
        subcategoryId: initialData.subcategoryId,
        isFeatured: initialData.isFeatured,
        isArchived: initialData.isArchived,
        description: normalizeRichTextContent(initialData.description),
      }
    : {
        name: '',
        images: [],
        price: 0,
        amountInStock: 0,
        subcategoryId: '',
        description: '',
        isFeatured: false,
        isArchived: false,
      };

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });

  const onSubmit = async (data: ProductFormValues) => {
    try {
      setLoading(true);
      if (initialData) {
        await axios.patch(`/api/${params?.storeId}/products/${params?.productId}`, data);
      } else {
        await axios.post(`/api/${params?.storeId}/products`, data);
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

  const watchedName = form.watch('name');
  const watchedPrice = Number(form.watch('price'));
  const watchedAmountInStock = Number(form.watch('amountInStock'));
  const watchedSubcategoryId = form.watch('subcategoryId');
  const watchedImages = form.watch('images') ?? [];
  const watchedDescription = form.watch('description') ?? '';
  const watchedDescriptionText = getPlainTextFromRichText(watchedDescription);
  const watchedDescriptionPreview =
    watchedDescriptionText.length > 160 ? `${watchedDescriptionText.slice(0, 160).trim()}...` : watchedDescriptionText;
  const watchedIsFeatured = Boolean(form.watch('isFeatured'));
  const watchedIsArchived = Boolean(form.watch('isArchived'));
  const productNamePreview = watchedName.trim() || 'Nenurodytas pavadinimas';
  const hasSubcategories = subcategories.length > 0;
  const submitDisabled = loading || !hasSubcategories;

  const selectedSubcategoryName =
    subcategories.find((subcategory) => subcategory.id === watchedSubcategoryId)?.name || 'Nepasirinkta';

  const priceLabel = Number.isFinite(watchedPrice) && watchedPrice > 0 ? formatter.format(watchedPrice) : 'Nenurodyta';
  const stockLabel = Number.isFinite(watchedAmountInStock) ? `${watchedAmountInStock} vnt.` : 'Nenurodyta';

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
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <FormSection title="Nuotraukos" description="Pirmoji nuotrauka bus produkto miniatiūra.">
                <FormField
                  control={form.control}
                  name="images"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <ImageUpload
                          value={field.value.map((image) => image.url)}
                          disabled={loading}
                          onChange={(url) => field.onChange([...field.value, { url }])}
                          onRemove={(url) => field.onChange(field.value.filter((current) => current.url !== url))}
                        />
                      </FormControl>
                      <FormDescription>
                        Įkeltos nuotraukos: <span className="font-medium text-foreground">{watchedImages.length}</span>
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
                    name="amountInStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kiekis sandėlyje</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="1" disabled={loading} placeholder="9" {...field} />
                        </FormControl>
                        <FormDescription>Naudojama likučio būsenai ir pirkimo apribojimams.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              <FormSection title="Aprašymas">
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
                          placeholder="Papasakokite apie prekę, jos savybes, medžiagas ir kuo ji išsiskiria."
                        />
                      </FormControl>
                      <FormDescription>
                        {watchedDescriptionText.length} simbolių. Galite naudoti antraštes, paryškinimą, citatas ir
                        sąrašus.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                        description="Produktas bus rodomas pagrindiniame puslapyje ir akcentuojamas pasiūlymuose."
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

              <FormSection title="Greita peržiūra">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prekė</p>
                    <p className="text-sm font-semibold leading-tight">{productNamePreview}</p>
                    <p className="text-xs text-muted-foreground">Subkategorija: {selectedSubcategoryName}</p>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">Kaina</p>
                      <p className="text-sm font-semibold">{priceLabel}</p>
                    </div>
                    <div className="rounded-md border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">Likutis</p>
                      <p className="text-sm font-semibold">{stockLabel}</p>
                    </div>
                    <div className="rounded-md border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">Nuotraukos</p>
                      <p className="text-sm font-semibold">{watchedImages.length}</p>
                    </div>
                    <div className="rounded-md border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">Aprašymas</p>
                      <p className="text-sm font-semibold">{watchedDescriptionText.length} s.</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="rounded-md border bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">Aprašymo peržiūra</p>
                    <p className="mt-1 text-sm leading-6 text-foreground">
                      {watchedDescriptionPreview || 'Aprašymas dar nepridėtas.'}
                    </p>
                  </div>

                  <Separator />

                  <div className="flex flex-wrap gap-2">
                    <Badge variant={watchedIsArchived ? 'destructive' : 'secondary'}>
                      {watchedIsArchived ? 'Archyvuota' : 'Aktyvi'}
                    </Badge>

                    {watchedIsFeatured ? <Badge>Rekomenduojama</Badge> : <Badge variant="outline">Standartinė</Badge>}

                    <Badge variant={watchedAmountInStock > 0 ? 'secondary' : 'destructive'}>
                      {watchedAmountInStock > 0 ? 'Yra sandėlyje' : 'Išparduota'}
                    </Badge>
                  </div>
                </div>
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
