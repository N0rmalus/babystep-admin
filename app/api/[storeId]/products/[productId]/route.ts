// Global imports
import { auth } from '@clerk/nextjs';
import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/cors';

// Personal imports
import prismadb from '@/lib/prismadb';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request, { params }: { params: { productId: string } }) {
  try {
    if (!params.productId) {
      return new NextResponse('Būtinas prekės ID', { status: 400, headers: corsHeaders });
    }

    const product = await prismadb.product.findUnique({
      where: {
        id: params.productId,
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

    return NextResponse.json(product, { headers: corsHeaders });
  } catch (error) {
    console.log('[PRODUCT_GET]', error);
    return new NextResponse('Internal error', { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req: Request, { params }: { params: { storeId: string; productId: string } }) {
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
    if (!params.productId) {
      return new NextResponse('Būtinas prekės ID', { status: 400 });
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

    await prismadb.product.update({
      where: {
        id: params.productId,
      },
      data: {
        name,
        price,
        amountInStock,
        subcategoryId,
        images: {
          deleteMany: {},
        },
        isFeatured,
        isArchived,
        description,
      },
    });

    const product = await prismadb.product.update({
      where: {
        id: params.productId,
      },
      data: {
        images: {
          createMany: {
            data: [...images.map((image: { url: string }) => image)],
          },
        },
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.log('[PRODUCT_PATCH]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { storeId: string; productId: string } }) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse('Neautentifikuota', { status: 401 });
    }
    if (!params.productId) {
      return new NextResponse('Būtinas prekės ID', { status: 400 });
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

    const product = await prismadb.product.deleteMany({
      where: {
        id: params.productId,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.log('[PRODUCT_DELETE]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
