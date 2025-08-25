"use client";

// Global imports
import * as z from "zod";
import axios from "axios";
import toast from "react-hot-toast";
import { useState } from "react";
import { Category, Image, Product, Subcategory } from "@prisma/client";
import { Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useRouter } from "next/navigation";

// Personal imports
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { AlertModal } from "@/components/modals/alert-modal";
import ImageUpload from "@/components/ui/image-upload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
    name: z.string().min(1),
    images: z.object({ url: z.string() }).array(),
    price: z.coerce.number().min(1),
    amountInStock: z.coerce.number().min(1),
    subcategoryId: z.string().min(1),
    isFeatured: z.boolean().default(false).optional(),
    isArchived: z.boolean().default(false).optional(),
    description: z.string().min(0),
});

type ProductFormValues = z.infer<typeof formSchema>;

interface ProductFormProps {
    initialData: Product & {
        images: Image[]
    } | null;
    subcategories: Subcategory[];
}

export const ProductForm: React.FC<ProductFormProps> = ({
    initialData,
    subcategories
}) => {
    const params = useParams();
    const router = useRouter();

    const [open, setOpen ] = useState(false);
    const [loading, setLoading] = useState(false);

    const title = initialData ? "Redaguoti prekę" : "Sukurti naują prekę";
    const pageDescription = initialData ? "Redagavimas" : "Nauja prekė";
    const toastMessage = initialData ? "Prekė atnaujinta." : "Prekė sukurta.";
    const action = initialData ? "Išsaugoti" : "Išsaugoti";

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(formSchema),
        // @ts-ignore
        defaultValues: initialData ? {
            ...initialData,
            price: parseFloat(String(initialData?.price)),
            subcategoryId: initialData.subcategoryId,
        } : {
            name: '',
            images: [],
            price: 0,
            amountInStock: 0,
            subcategoryId: '',
            description: '',
            isFeatured: false,
            isArchived: false,
        }
    });
    
    const onSubmit = async (data: ProductFormValues) => {
        try {
            setLoading(true);
            if(initialData) {
                await axios.patch(`/api/${params?.storeId}/products/${params?.productId}`, data);
            } else {
                await axios.post(`/api/${params?.storeId}/products`, data);
            }
            router.refresh();
            router.push(`/${params?.storeId}/products`);
            toast.success(toastMessage);
        } catch(error) {
            toast.error("Kažkas nepavyko.");
        } finally {
            setLoading(false);
        }
    }

    const onDelete = async () => {
        try {
            setLoading(true);
            await axios.delete(`/api/${params?.storeId}/products/${params?.productId}`);
            router.refresh();
            router.push(`/${params?.storeId}/products`);
            toast.success("Prekė panaikinta.");
        } catch(error) {
            toast.error("Kažkas nepavyko.");
        } finally {
            setLoading(false);
            setOpen(false);
        }
    }

    return (
        <>
            <AlertModal isOpen={open} onClose={() => setOpen(false)} onConfirm={onDelete} loading={loading} />
            <div className="flex items-center justify-between">
                <Heading title={title} description={pageDescription} /> 
                {initialData && (
                    <Button disabled={loading} variant="destructive" size="icon" onClick={() => setOpen(true)}>
                        <Trash className="h-4 w-4" />
                    </Button>
                )}
            </div>
            <Separator />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 w-full">
                    <FormField control={form.control} name="images" render={({ field }) => (
                        <FormItem>
                            <FormLabel> Fono paveikslėlis </FormLabel>
                            <FormControl>
                                <ImageUpload value={field.value.map((image) => image.url)} disabled={loading} onChange={(url) => field.onChange([...field.value, { url }])} onRemove={(url) => field.onChange([...field.value.filter((current) => current.url !== url)])} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <div className="grid grid-cols-3 gap-8">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel> Pavadinimas </FormLabel>
                                <FormControl>
                                    <Input maxLength={191} disabled={loading} placeholder="Prekės pavadinimas" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="price" render={({ field }) => (
                            <FormItem>
                                <FormLabel> Kaina </FormLabel>
                                <FormControl>
                                    <Input type="number" disabled={loading} placeholder="9.99" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="subcategoryId" render={({ field }) => (
                            <FormItem>
                                <FormLabel> Subkategorija </FormLabel>
                                <Select disabled={loading} onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue defaultValue={field.value} placeholder="Pasirinkite subkategoriją" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {subcategories.map((subcategory) => (
                                            <SelectItem key={subcategory.id} value={subcategory.id}>
                                                {subcategory.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="amountInStock" render={({ field }) => (
                            <FormItem>
                                <FormLabel> Kiekis sandėlyje </FormLabel>
                                <FormControl>
                                    <Input type="number" disabled={loading} placeholder="9" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel> Aprašymas </FormLabel>
                                <FormControl>
                                    <Textarea maxLength={512} placeholder="Prekės aprašymas" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="isFeatured" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                    <Checkbox checked={field.value} 
                                    // @ts-ignore 
                                    onCheckedChange={field.onChange} />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>
                                        Rekomenduojama
                                    </FormLabel>
                                    <FormDescription>
                                        Ši prekė bus rodoma pagrindiniame puslapyje
                                    </FormDescription>
                                </div>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="isArchived" render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                    <Checkbox checked={field.value} 
                                    // @ts-ignore 
                                    onCheckedChange={field.onChange} />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>
                                        Archivuota
                                    </FormLabel>
                                    <FormDescription>
                                        Ši prekė niekur nebus rodoma parduotuvėje
                                    </FormDescription>
                                </div>
                            </FormItem>
                        )} />
                    </div>
                    <Button disabled={loading} className="ml-auto" type="submit">
                        {action}
                    </Button>
                </form>
            </Form>
        </>
    );
}