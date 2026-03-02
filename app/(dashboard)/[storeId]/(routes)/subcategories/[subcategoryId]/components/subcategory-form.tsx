'use client';

import * as z from 'zod';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { Category, Subcategory } from '@prisma/client';
import { Trash } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { AlertModal } from '@/components/modals/alert-modal';
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from '@/components/ui/select';

const formSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().min(1),
});

type SubcategoryFormValues = z.infer<typeof formSchema>;

interface SubcategoryFormProps {
  initialData: Subcategory | null;
  categories: Category[];
}

export const SubcategoryForm: React.FC<SubcategoryFormProps> = ({ initialData, categories }) => {
  const params = useParams();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = initialData ? 'Redaguoti subkategoriją' : 'Sukurti naują subkategoriją';
  const description = initialData ? 'Redagavimas' : 'Nauja subkategorija';
  const toastMessage = initialData ? 'Subkategorija atnaujinta.' : 'Subkategorija sukurta.';
  const action = initialData ? 'Išsaugoti' : 'Išsaugoti';

  const form = useForm<SubcategoryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: '',
      categoryId: '',
    },
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
      toast.error('Kažkas nepavyko.');
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
      toast.error('Pirmiausia įsitikinkite, kad pašalinote visas prekes, naudojančias šią subkategoriją.');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      <AlertModal isOpen={open} onClose={() => setOpen(false)} onConfirm={onDelete} loading={loading} />
      <div className="flex items-center justify-between">
        <Heading title={title} description={description} />
        {initialData && (
          <Button disabled={loading} variant="destructive" size="icon" onClick={() => setOpen(true)}>
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Separator />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-8">
          <div className="grid grid-cols-3 gap-8">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel> Pavadinimas </FormLabel>
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
                  <FormLabel> Kategorija </FormLabel>
                  <Select disabled={loading} onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue defaultValue={field.value} placeholder="Pasirinkite kategoriją." />
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
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button disabled={loading} className="ml-auto" type="submit">
            {action}
          </Button>
        </form>
      </Form>
    </>
  );
};
