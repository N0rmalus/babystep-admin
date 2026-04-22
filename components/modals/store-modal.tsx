'use client';

// Global imports
import * as z from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useStoreModal } from '@/hooks/use-store-modal';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/modal';
import { toast } from 'react-hot-toast';
import axios from 'axios';

// Personal imports
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const formSchema = z.object({
  name: z.string().min(1),
});

export const StoreModal = () => {
  const storeModal = useStoreModal();

  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setLoading(true);

      const response = await axios.post('/api/stores', values);

      window.location.assign(`/${response.data.id}`);
    } catch (error) {
      toast.error('Kažkas nepavyko.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Sukurti parduotuvę"
      description="Pridėkite naują parduotuvę ir tvarkykite prekes bei kategorijas."
      isOpen={storeModal.isOpen}
      onClose={storeModal.onClose}
    >
      <div>
        <div className="space-y-4 py-2 pb-4">
          <div className="space-y-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel> Pavadinimas </FormLabel>
                      <FormControl>
                        <Input disabled={loading} placeholder="Babystep" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex w-full items-center justify-end space-x-2 pt-6">
                  <Button type="button" disabled={loading} variant="outline" onClick={storeModal.onClose}>
                    {' '}
                    Atšaukti{' '}
                  </Button>
                  <Button disabled={loading} type="submit">
                    {' '}
                    Tęsti{' '}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </Modal>
  );
};
