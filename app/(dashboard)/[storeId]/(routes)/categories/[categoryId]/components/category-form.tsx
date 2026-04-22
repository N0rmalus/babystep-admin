'use client';

import Link from 'next/link';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { Billboard, Category } from '@prisma/client';
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
import {
  categoryFormSchema,
  CategoryFormValues,
} from '@/app/(dashboard)/[storeId]/(routes)/categories/[categoryId]/components/schema';

type Props = {
  initialData: Category | null;
  billboards: Billboard[];
};

export const CategoryForm = ({ initialData, billboards }: Props) => {
  const params = useParams();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = initialData ? 'Redaguoti kategoriją' : 'Sukurti naują kategoriją';
  const toastMessage = initialData ? 'Kategorija atnaujinta.' : 'Kategorija sukurta.';
  const action = initialData ? 'Išsaugoti pakeitimus' : 'Sukurti kategoriją';

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data;
      if (typeof data === 'string' && data.trim().length > 0) {
        return data;
      }
      if (data && typeof data === 'object' && 'message' in data) {
        const message = (data as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim().length > 0) {
          return message;
        }
      }
      if (error.message) {
        return error.message;
      }
    }

    return 'Įvyko klaida.';
  };

  const defaultValues: CategoryFormValues = initialData
    ? {
        name: initialData.name,
        billboardId: initialData.billboardId,
      }
    : {
        name: '',
        billboardId: '',
      };

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues,
  });

  const onSubmit = async (data: CategoryFormValues) => {
    try {
      setLoading(true);

      if (initialData) {
        await axios.patch(`/api/${params?.storeId}/categories/${params?.categoryId}`, data);
      } else {
        await axios.post(`/api/${params?.storeId}/categories`, data);
      }

      router.refresh();
      router.push(`/${params?.storeId}/categories`);
      toast.success(toastMessage);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    try {
      setLoading(true);
      await axios.delete(`/api/${params?.storeId}/categories/${params?.categoryId}`);
      router.refresh();
      router.push(`/${params?.storeId}/categories`);
      toast.success('Kategorija panaikinta.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const watchedBillboardId = form.watch('billboardId');
  const hasBillboards = billboards.length > 0;
  const submitDisabled = loading || !hasBillboards;
  const selectedBillboard = billboards.find((billboard) => billboard.id === watchedBillboardId) || null;

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
              <FormSection title="Pagrindinė informacija">
                <div className="grid gap-5 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pavadinimas</FormLabel>
                        <FormControl>
                          <Input disabled={loading} placeholder="Kategorijos pavadinimas" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="billboardId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Skelbimų lenta</FormLabel>
                        <Select disabled={loading || !hasBillboards} onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  hasBillboards ? 'Pasirinkite skelbimų lentą' : 'Pirma sukurkite skelbimų lentą'
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {billboards.map((billboard) => (
                              <SelectItem key={billboard.id} value={billboard.id}>
                                {billboard.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!hasBillboards && (
                          <FormDescription>
                            Pirma sukurkite bent vieną
                            <Link href={`/${params?.storeId}/billboards/new`} className="ml-1 text-blue-500 underline">
                              skelbimų lentą
                            </Link>
                            , kad būtų galima išsaugoti kategoriją.
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              <FormSection title="Skelbimų lentos peržiūra">
                <div className="overflow-hidden rounded-xl bg-muted/20">
                  {selectedBillboard?.imageUrl ? (
                    <>
                      <div
                        style={{
                          backgroundImage: `url(${selectedBillboard.imageUrl})`,
                          backgroundPosition: 'center',
                        }}
                        className="relative aspect-square overflow-hidden rounded-xl bg-cover md:aspect-[2.4/1]"
                      >
                        <div className="flex h-full w-full flex-col items-center justify-center gap-y-8 text-center">
                          <div className="max-w-xs text-3xl font-bold opacity-70 sm:max-w-xl sm:text-5xl lg:text-7xl">
                            {selectedBillboard.label}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center bg-card p-6 text-center text-sm text-muted-foreground">
                      Pasirinkite skelbimų lentą, kad matytumėte jos peržiūrą.
                    </div>
                  )}
                </div>
              </FormSection>
            </div>

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
                  onClick={() => router.push(`/${params?.storeId}/categories`)}
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
