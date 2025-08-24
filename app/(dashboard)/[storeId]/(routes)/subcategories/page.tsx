import { format } from "date-fns";
import prismadb from "@/lib/prismadb";

import { SubcategoryClient } from "@/app/(dashboard)/[storeId]/(routes)/subcategories/components/client";
import { SubCategoryColumn } from "@/app/(dashboard)/[storeId]/(routes)/subcategories/components/columns";

const SubCategoriesPage = async ({
    params
}: {
    params: { storeId: string }
}) => {

    return (
        <div className="flex-col">
            <div className="flex-1 space-y-4 p-8 pt-6">
                {/*<SubcategoryClient data={[]} />*/}
            </div>
        </div>
    )
}

export default SubCategoriesPage;