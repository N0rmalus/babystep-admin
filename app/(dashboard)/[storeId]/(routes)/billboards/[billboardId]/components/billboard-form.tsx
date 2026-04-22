'use client';

import axios from 'axios';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { Billboard } from '@prisma/client';
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
import ImageUpload from '@/components/ui/image-upload';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  billboardFormSchema,
  BillboardFormValues,
} from '@/app/(dashboard)/[storeId]/(routes)/billboards/[billboardId]/components/schema';

type Props = {
  initialData: Billboard | null;
};

export const BillboardForm = ({ initialData }: Props) => {
  const params = useParams();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = initialData ? 'Redaguoti skelbimų lentą' : 'Sukurti skelbimų lentą';
  const toastMessage = initialData ? 'Skelbimų lenta atnaujinta.' : 'Skelbimų lenta sukurta.';
  const action = initialData ? 'Išsaugoti pakeitimus' : 'Sukurti skelbimų lentą';

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

  const defaultValues: BillboardFormValues = initialData
    ? {
        label: initialData.label,
        imageUrl: initialData.imageUrl,
      }
    : {
        label: '',
        imageUrl: '',
      };

  const form = useForm<BillboardFormValues>({
    resolver: zodResolver(billboardFormSchema),
    defaultValues,
  });

  const onSubmit = async (data: BillboardFormValues) => {
    try {
      setLoading(true);

      if (initialData) {
        await axios.patch(`/api/${params.storeId}/billboards/${params.billboardId}`, data);
      } else {
        await axios.post(`/api/${params.storeId}/billboards`, data);
      }

      router.refresh();
      router.push(`/${params.storeId}/billboards`);
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
      await axios.delete(`/api/${params.storeId}/billboards/${params.billboardId}`);
      router.refresh();
      router.push(`/${params.storeId}/billboards`);
      toast.success('Skelbimų lenta panaikinta.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const watchedLabel = form.watch('label');
  const watchedImageUrl = form.watch('imageUrl');
  const billboardLabelPreview = watchedLabel.trim() || 'Nepavadinta skelbimų lenta';

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
              <FormSection title="Vaizdas">
                <div className="space-y-5">
                  <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pavadinimas</FormLabel>
                        <FormControl>
                          <Input disabled={loading} placeholder="Reklaminės lentos pavadinimas" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pagrindinis paveikslėlis</FormLabel>
                        <FormControl>
                          <ImageUpload
                            value={field.value ? [field.value] : []}
                            disabled={loading}
                            onChange={(url) => field.onChange(url)}
                            onRemove={() => field.onChange('')}
                          />
                        </FormControl>
                        <FormDescription>
                          Šis paveikslėlis bus rodomas kategorijų hero zonoje ir jų peržiūrose.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              <FormSection title="Greita peržiūra">
                <div className="overflow-hidden rounded-xl border bg-muted/20">
                  {watchedImageUrl ? (
                    <div
                      style={{
                        backgroundImage: `url(${watchedImageUrl})`,
                        backgroundPosition: 'center',
                      }}
                      className="relative aspect-square overflow-hidden rounded-xl bg-cover md:aspect-[2.4/1]"
                    >
                      <div className="flex h-full w-full flex-col items-center justify-center gap-y-8 text-center">
                        <div className="max-w-xs text-3xl font-bold opacity-70 sm:max-w-xl sm:text-5xl lg:text-7xl">
                          {billboardLabelPreview}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
                      Įkelkite paveikslėlį, kad matytumėte skelbimų lentos peržiūrą.
                    </div>
                  )}
                </div>
              </FormSection>
            </div>

            <aside className="space-y-6 xl:sticky xl:top-6 xl:h-fit">
              <FormSection>
                <Button disabled={loading} className="w-full" type="submit">
                  {loading ? 'Saugoma...' : action}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  className="w-full"
                  onClick={() => router.push(`/${params.storeId}/billboards`)}
                >
                  Atšaukti
                </Button>
              </FormSection>
            </aside>
          </div>
        </form>
      </Form>
    </>
  );
};
