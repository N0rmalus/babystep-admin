'use client';

import toast from 'react-hot-toast';
import { useState } from 'react';
import { Store } from '@prisma/client';
import { Trash } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form/form';
import { Input } from '@/components/ui/input';
import { AlertModal } from '@/components/modals/alert-modal';
import { ApiAlert } from '@/components/ui/api-alert';
import { useOrigin } from '@/hooks/use-origin';
import { getFormErrorMessage } from '@/lib/get-form-error-message';
import { getNextOrderNumberMessage } from '@/lib/store-settings';
import {
  settingsFormSchema,
  SettingsFormValues,
} from '@/app/(dashboard)/[storeId]/(routes)/settings/components/schema';
import axios from 'axios';

type Props = {
  initialData: Store;
  highestOrderNumber: number | null;
};

const NO_ORDERS_HINT = 'Parduotuvė dar neturi užsakymų.';

export const SettingsForm = ({ initialData, highestOrderNumber }: Props) => {
  const params = useParams();
  const router = useRouter();
  const origin = useOrigin();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: { name: initialData.name, nextOrderNumber: initialData.nextOrderNumber },
  });
  const nextOrderNumberHint =
    highestOrderNumber === null ? NO_ORDERS_HINT : getHighestOrderNumberHint(highestOrderNumber);

  const onSubmit = async ({ name, nextOrderNumber }: SettingsFormValues) => {
    const isNextOrderNumberChanged = form.formState.dirtyFields.nextOrderNumber === true;
    const nextOrderNumberMessage = isNextOrderNumberChanged
      ? getNextOrderNumberMessage({ nextOrderNumber, highestOrderNumber })
      : null;

    if (nextOrderNumberMessage) {
      form.setError('nextOrderNumber', { message: nextOrderNumberMessage });
      return;
    }

    try {
      setLoading(true);
      await axios.patch(`/api/stores/${params.storeId}`, {
        name,
        nextOrderNumber: isNextOrderNumberChanged ? nextOrderNumber : undefined,
      });
      form.reset({ name, nextOrderNumber });
      router.refresh();
      toast.success('Parduotuvė atnaujinta.');
    } catch (error) {
      toast.error(getFormErrorMessage(error, 'Kažkas nepavyko.'));
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    try {
      setLoading(true);
      await axios.delete(`/api/stores/${params.storeId}`);
      router.refresh();
      router.push('/');
      toast.success('Parduotuvė ištrinta.');
    } catch {
      toast.error('Pirmiausia įsitikinkite, kad pašalinote visas prekes ir kategorijas.');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      <AlertModal isOpen={open} onClose={() => setOpen(false)} onConfirm={onDelete} loading={loading} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Heading title="Nustatymai" />
        <Button
          disabled={loading}
          variant="destructive"
          size="icon"
          className="self-start"
          onClick={() => setOpen(true)}
        >
          <Trash className="h-4 w-4" />
        </Button>
      </div>
      <Separator />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-8">
          <div className="grid max-w-2xl grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 xl:grid-cols-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel> Pavadinimas </FormLabel>
                  <FormControl>
                    <Input disabled={loading} placeholder="Parduotuvės pavadinimas" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nextOrderNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kitas užsakymo numeris</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" step="1" disabled={loading} {...field} />
                  </FormControl>
                  <FormDescription>{nextOrderNumberHint}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button disabled={loading} className="w-full sm:ml-auto sm:w-auto" type="submit">
            Išsaugoti pakeitimus
          </Button>
        </form>
      </Form>
      <Separator />
      <ApiAlert title="NEXT_PUBLIC_API_URL" description={`${origin}/api/${params.storeId}`} variant="public" />
    </>
  );
};

const getHighestOrderNumberHint = (highestOrderNumber: number) =>
  `Turi būti didesnis nei didžiausias esamas numeris (${highestOrderNumber}).`;
