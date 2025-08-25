import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET (
    req: Request,
    { params }: { params: { subcategoryId: string } }
) {
    try {
        if(!params.subcategoryId) {
            return new NextResponse("Subcategory ID is required", { status: 400 });
        }

        const subcategory = await prismadb.subcategory.findUnique({
            where: {
                id: params.subcategoryId,
            },
            include: {
                category: true,
            }
        });

        return NextResponse.json(subcategory);
    } catch(error) {
        console.log('[SUBCATEGORY_GET]', error);
        return new NextResponse("Internal error", { status: 500 });
    }
};

export async function PATCH (
    req: Request,
    { params }: { params: { storeId: string, subcategoryId: string } }
) {
    try {
        const { userId } = auth();
        const body = await req.json();

        const { name, categoryId } = body;

        if(!userId) {
            return new NextResponse("Unauthenticated", { status: 401 });
        }
        if(!name) {
            return new NextResponse("Name is required", { status: 400 });
        }
        if(!categoryId) {
            return new NextResponse("Category ID is required", { status: 400 });
        }
        if(!params.subcategoryId) {
            return new NextResponse("Subcategory ID is required", { status: 400 });
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

        const subcategory = await prismadb.subcategory.updateMany({
            where: {
                id: params.subcategoryId,
            },
            data: {
                name,
                categoryId
            }
        });

        return NextResponse.json(subcategory);
    } catch(error) {
        console.log('[SUBCATEGORY_PATCH]', error);
        return new NextResponse("Internal error", { status: 500 });
    }
};

export async function DELETE (
    req: Request,
    { params }: { params: { storeId: string, subcategoryId: string } }
) {
    try {
        const { userId } = auth();

        if(!userId) {
            return new NextResponse("Unauthenticated", { status: 401 });
        }
        if(!params.subcategoryId) {
            return new NextResponse("Subcategory ID is required", { status: 400 });
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

        const subcategory = await prismadb.subcategory.deleteMany({
            where: {
                id: params.subcategoryId,
            }
        });

        return NextResponse.json(subcategory);
    } catch(error) {
        console.log('[SUBCATEGORY_DELETE]', error);
        return new NextResponse("Internal error", { status: 500 });
    }
};

