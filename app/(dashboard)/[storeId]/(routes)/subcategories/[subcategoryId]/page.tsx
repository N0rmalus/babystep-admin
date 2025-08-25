import prismadb from "@/lib/prismadb";
import { SubcategoryForm } from "./components/subcategory-form";

const SubcategoryPage = async ({
    params
}: {
    params: { subcategoryId: string, storeId: string }
}) => {
    const subcategory = params.subcategoryId !== "new"
        ? await prismadb.subcategory.findUnique({
            where: { id: params.subcategoryId }
        })
        : null;

    const categories = await prismadb.category.findMany({
        where: { storeId: params.storeId }
    });

    return (
        <div className="flex-col">
            <div className="flex-1 space-y-4 p-8 pt-6">
                <SubcategoryForm categories={categories} initialData={subcategory} />
            </div>
        </div>
    );
}

export default SubcategoryPage;

