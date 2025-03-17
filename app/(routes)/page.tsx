import getBillboard from "@/actions/get-billboard";
import getProducts from "@/actions/get-products";
import Billboard from "@/components/ui/billboard";
import ProductList from "@/components/product-list";
import Container from "@/components/ui/container"

export const revalidate = 0;

const HomePage = async () => {
    const indexBillboard = process.env.INDEX_BILLBOARD_ID;
    const products = await getProducts({ isFeatured: true });
    // @ts-ignore
    const billboard = await getBillboard(indexBillboard);

    return (
        <Container>
            <div className="space-y-10 pb-10">
                <Billboard data={billboard} />
                <div className="flex flex-col gap-y-8 px-4 sm:px-6 lg:px-8">
                    <ProductList title="Rekomenduojama" items={products} />
                </div>
            </div>
        </Container>
    );
}

export default HomePage;