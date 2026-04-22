'use client';

import Link from 'next/link';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { Category, Subcategory } from '@prisma/client';
import { Trash } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { FormSection } from '@/components/ui/form/form-section';
import { Heading } from '@/components/ui/heading';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { getFormErrorMessage } from '@/lib/get-form-error-message';
import {
  subcategoryFormSchema,
  SubcategoryFormValues,
} from '@/app/(dashboard)/[storeId]/(routes)/subcategories/[subcategoryId]/components/schema';
import axios from 'axios';

type Props = {
  initialData: Subcategory | null;
  categories: Category[];
};

export const SubcategoryForm = ({ initialData, categories }: Props) => {
  const params = useParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = initialData ? 'Redaguoti subkategoriją' : 'Sukurti naują subkategoriją';
  const toastMessage = initialData ? 'Subkategorija atnaujinta.' : 'Subkategorija sukurta.';
  const action = initialData ? 'Išsaugoti pakeitimus' : 'Sukurti subkategoriją';

  const defaultValues: SubcategoryFormValues = initialData
    ? {
        name: initialData.name,
        categoryId: initialData.categoryId,
      }
    : {
        name: '',
        categoryId: '',
      };

  const form = useForm<SubcategoryFormValues>({
    resolver: zodResolver(subcategoryFormSchema),
    defaultValues,
  });

  const onSubmit = async (data: SubcategoryFormValues) => {
    try {
      setLoading(true);

      if (initialData) {
        await axios.patch(`/api/${params?.storeId}/subcategories/${params?.subcategoryId}`, data);
      } else {
        await axios.post(`/api/${params?.storeId}/subcategories`, data);
      }

      router.refresh();
      router.push(`/${params?.storeId}/subcategories`);
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
      await axios.delete(`/api/${params?.storeId}/subcategories/${params?.subcategoryId}`);
      router.refresh();
      router.push(`/${params?.storeId}/subcategories`);
      toast.success('Subkategorija panaikinta.');
    } catch (error) {
      toast.error(getFormErrorMessage(error));
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const hasCategories = categories.length > 0;
  const submitDisabled = loading || !hasCategories;

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
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <FormSection title="Pagrindinė informacija">
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pavadinimas</FormLabel>
                      <FormControl>
                        <Input disabled={loading} placeholder="Subkategorijos pavadinimas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategorija</FormLabel>
                      <Select disabled={loading || !hasCategories} onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={hasCategories ? 'Pasirinkite kategoriją' : 'Pirma sukurkite kategoriją'}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!hasCategories && (
                        <FormDescription>
                          Pirma sukurkite bent vieną
                          <Link href={`/${params?.storeId}/categories/new`} className="ml-1 text-blue-500 underline">
                            kategoriją
                          </Link>
                          , kad būtų galima išsaugoti subkategoriją.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </FormSection>

            <div className="xl:sticky xl:top-6 xl:h-fit">
              <FormSection>
                <Button disabled={submitDisabled} className="w-full" type="submit">
                  {loading ? 'Saugoma...' : action}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  className="w-full"
                  onClick={() => router.push(`/${params?.storeId}/subcategories`)}
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
