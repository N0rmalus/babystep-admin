// Global imports
import { auth } from '@clerk/nextjs';
import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/cors';

// Personal imports
import prismadb from '@/lib/prismadb';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { userId } = auth();
    const body = await req.json();

    const { name, price, amountInStock, subcategoryId, images, isFeatured, isArchived, description } = body;

    if (!userId) {
      return new NextResponse('Neautentifikuota', { status: 401 });
    }
    if (!name) {
      return new NextResponse('Būtina nurodyti pavadinimą', { status: 400 });
    }
    if (!images || !images.length) {
      return new NextResponse('Reikalingi vaizdai', { status: 400 });
    }
    if (!price) {
      return new NextResponse('Reikalinga kaina', { status: 400 });
    }
    if (amountInStock === undefined || amountInStock === null) {
      return new NextResponse('Reikalingas kiekis sandėlyje', { status: 400 });
    }
    if (!subcategoryId) {
      return new NextResponse('Būtinas subkategorijos ID', { status: 400 });
    }
    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400 });
    }

    const storeByUserId = await prismadb.store.findFirst({
      where: {
        id: params.storeId,
        userId,
      },
    });

    if (!storeByUserId) {
      return new NextResponse('Neautorizuota', { status: 403 });
    }

    const product = await prismadb.product.create({
      data: {
        name,
        price,
        amountInStock,
        subcategoryId,
        isFeatured,
        isArchived,
        description,
        storeId: params.storeId,
        images: {
          createMany: {
            data: [...images.map((image: { url: string }) => image)],
          },
        },
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.log('[PRODUCTS_POST]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const subcategoryId = searchParams.get('subcategoryId') || undefined;
    const isFeatured = searchParams.get('isFeatured') || undefined;

    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400, headers: corsHeaders });
    }

    const products = await prismadb.product.findMany({
      where: {
        storeId: params.storeId,
        subcategoryId,
        isFeatured: isFeatured ? true : undefined,
        isArchived: false,
      },
      include: {
        images: true,
        subcategory: {
          include: {
            category: true,
          },
        },
      },
    });

    return NextResponse.json(products, { headers: corsHeaders });
  } catch (error) {
    console.log('[PRODUCTS_GET]', error);
    return new NextResponse('Internal error', { status: 500, headers: corsHeaders });
  }
}
