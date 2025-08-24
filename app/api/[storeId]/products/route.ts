// Global imports
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

// Personal imports
import prismadb from "@/lib/prismadb";


export async function POST(
    req: Request,
    { params }: { params: { storeId: string } }
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
        if(!params.storeId) {
            return new NextResponse("Būtinas parduotuvės ID", { status: 400});
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

        const product = await prismadb.product.create({
            data: {
                name,
                price,
                amountInStock,
                categoryId,
                colorId,
                sizeId,
                isFeatured,
                isArchived,
                description,
                storeId: params.storeId,
                images: {
                    createMany: {
                        data: [
                            ...images.map((image: { url: string }) => image)
                        ]
                    }
                }
            }
        });

        return NextResponse.json(product);
    } catch(error){
        console.log('[PRODUCTS_POST]', error);
        return new NextResponse("Internal error", { status: 500 });
    }
}

export async function GET(
    req: Request,
    { params }: { params: { storeId: string } }
) {
    try {
        const { searchParams } = new URL(req.url);
        const categoryId = searchParams.get("categoryId") || undefined;
        const colorId = searchParams.get("colorId") || undefined;
        const sizeId = searchParams.get("sizeId") || undefined;
        const isFeatured = searchParams.get("isFeatured") || undefined;

        if(!params.storeId) {
            return new NextResponse("Būtinas parduotuvės ID", { status: 400});
        }

        const products = await prismadb.product.findMany({
            where: {
                storeId: params.storeId,
                categoryId,
                colorId,
                sizeId,
                isFeatured: isFeatured ? true : undefined,
                isArchived: false
            },
            include: {
                images: true,
                category: true,
                color: true,
                size: true
            }
        });

        return NextResponse.json(products);
    } catch(error){
        console.log('[PRODUCTS_GET]', error);
        return new NextResponse("Internal error", { status: 500 });
    }
}