// Global imports
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

// Personal imports
import prismadb from "@/lib/prismadb";

export async function GET (
    req: Request,
    { params }: { params: { productId: string } }
) {
    try {
        if(!params.productId) {
            return new NextResponse("Būtinas prekės ID", { status: 400 });
        }

        const product = await prismadb.product.findUnique({
            where: {
                id: params.productId,
            },
            include: {
                images: true,
                category: true,
                size: true,
                color: true
            }
        });

        return NextResponse.json(product);
    } catch(error) {
        console.log('[PRODUCT_GET]', error);
        return new NextResponse("Internal error", { status: 500 });
    }
};

export async function PATCH (
    req: Request,
    { params }: { params: { storeId: string, productId: string } }
) {
    try {
        const { userId } = auth();
        const body = await req.json();

        const { 
            name,
            price,
            amountInStock,
            categoryId,
            colorId,
            sizeId,
            images,
            isFeatured,
            isArchived,
            description,
        } = body;

        if(!userId) {
            return new NextResponse("Neautentifikuota", { status: 401 });
        }
        if(!name) {
            return new NextResponse("Būtina nurodyti pavadinimą", { status: 400});
        }
        if(!images || !images.length) {
            return new NextResponse("Reikalingi vaizdai", { status: 400});
        }
        if(!price) {
            return new NextResponse("Reikalinga kaina", { status: 400});
        }
        if(!amountInStock) {
            return new NextResponse("Reikalingas kiekis sandėlyje", { status: 400});
        }
        if(!categoryId) {
            return new NextResponse("Būtinas kategorijos ID", { status: 400});
        }
        if(!colorId) {
            return new NextResponse("Reikalingas spalvos ID", { status: 400});
        }
        if(!sizeId) {
            return new NextResponse("Reikalingas dydžio ID", { status: 400});
        }
        if(!params.productId) {
            return new NextResponse("Būtinas prekės ID", { status: 400});
        }

        const storeByUserId = await prismadb.store.findFirst({
            where: {
                id: params.storeId,
                userId
            }
        })

        if(!storeByUserId) {
            return new NextResponse("Neautorizuota", { status: 403 });
        }

        await prismadb.product.update({
            where: {
                id: params.productId,
            },
            data: {
                name,
                price,
                amountInStock,
                categoryId,
                colorId,
                sizeId,
                images: {
                    deleteMany: {}
                },
                isFeatured,
                isArchived,
                description,
            }
        });

        const product = await prismadb.product.update({
            where: {
                id: params.productId
            },
            data: {
                images: {
                    createMany: {
                        data: [
                            ...images.map((image: { url: string }) => image),
                        ]
                    }
                }
            }
        })

        return NextResponse.json(product);
    } catch(error) {
        console.log('[PRODUCT_PATCH]', error);
        return new NextResponse("Internal error", { status: 500 });
    }
};

export async function DELETE (
    req: Request,
    { params }: { params: { storeId: string, productId: string } }
) {
    try {
        const { userId } = auth();

        if(!userId) {
            return new NextResponse("Neautentifikuota", { status: 401 });
        }
        if(!params.productId) {
            return new NextResponse("Būtinas prekės ID", { status: 400 });
        }

        const storeByUserId = await prismadb.store.findFirst({
            where: {
                id: params.storeId,
                userId
            }
        })

        if(!storeByUserId) {
            return new NextResponse("Neautorizuota", { status: 403 });
        }

        const product = await prismadb.product.deleteMany({
            where: {
                id: params.productId,
            }
        });

        return NextResponse.json(product);
    } catch(error) {
        console.log('[PRODUCT_DELETE]', error);
        return new NextResponse("Internal error", { status: 500 });
    }
};