// Global imports
import { auth } from "@clerk/nextjs";
import { NextResponse } from "next/server";

// Personal imports
import prismadb from "@/lib/prismadb";

// Updates the name function
export async function PATCH (
    req: Request,
    { params }: { params: { storeId: string } }
) {
    try {
        const { userId } = auth();
        const body = await req.json();

        const { name } = body;

        if(!userId) {
            return new NextResponse("Neautentifikuota", { status: 401 });
        }
        if(!name) {
            return new NextResponse("Būtina nurodyti pavadinimą", { status: 400 });
        }
        if(!params.storeId) {
            return new NextResponse("Būtinas parduotuvės ID", { status: 400 });
        }

        const store = await prismadb.store.updateMany({
            where: {
                id: params.storeId,
                userId
            },
            data: {
                name
            }
        });

        return NextResponse.json(store);
    } catch(error) {
        console.log('[STORE_PATCH]', error);
        return new NextResponse("Internal error", { status: 500 });
    }
};

// Delete the store function
export async function DELETE (
    req: Request,
    { params }: { params: { storeId: string } }
) {
    try {
        const { userId } = auth();

        if(!userId) {
            return new NextResponse("Neautentifikuota", { status: 401 });
        }
        if(!params.storeId) {
            return new NextResponse("Būtinas parduotuvės ID", { status: 400 });
        }

        const store = await prismadb.store.deleteMany({
            where: {
                id: params.storeId,
                userId
            }
        });

        return NextResponse.json(store);
    } catch(error) {
        console.log('[STORE_DELETE]', error);
        return new NextResponse("Internal error", { status: 500 });
    }
};