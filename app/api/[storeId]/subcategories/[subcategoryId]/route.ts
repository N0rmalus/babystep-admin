import { auth } from '@clerk/nextjs';
import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/cors';
import prismadb from '@/lib/prismadb';
import { getCategory } from '@/queries/get-category';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';
import { getSubcategory } from '@/queries/get-subcategory';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request, { params }: { params: { storeId: string; subcategoryId: string } }) {
  try {
    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400, headers: corsHeaders });
    }
    if (!params.subcategoryId) {
      return new NextResponse('Būtinas subkategorijos ID', { status: 400, headers: corsHeaders });
    }

    const subcategory = await getSubcategory(params.storeId, params.subcategoryId, { includeCategory: true });

    if (!subcategory) {
      return new NextResponse('Subkategorija šioje parduotuvėje nerasta', { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(subcategory, { headers: corsHeaders });
  } catch (error) {
    console.log('[SUBCATEGORY_GET]', error);
    return new NextResponse('Internal error', { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req: Request, { params }: { params: { storeId: string; subcategoryId: string } }) {
  try {
    const { userId } = auth();
    const body = await req.json();

    const { name, categoryId } = body;

    if (!userId) {
      return new NextResponse('Neautentifikuota', { status: 401 });
    }
    if (!name) {
      return new NextResponse('Būtina nurodyti pavadinimą', { status: 400 });
    }
    if (!categoryId) {
      return new NextResponse('Reikalingas kategorijos ID', { status: 400 });
    }
    if (!params.subcategoryId) {
      return new NextResponse('Būtinas subkategorijos ID', { status: 400 });
    }

    const storeByUserId = await getStoreByUserId(params.storeId, userId);

    if (!storeByUserId) {
      return new NextResponse('Neautorizuota', { status: 403 });
    }

    const subcategoryByStore = await getSubcategory(params.storeId, params.subcategoryId);

    if (!subcategoryByStore) {
      return new NextResponse('Subkategorija šioje parduotuvėje nerasta', { status: 404 });
    }

    const category = await getCategory(params.storeId, categoryId);

    if (!category) {
      return new NextResponse('Kategorija šiai parduotuvei nerasta', { status: 404 });
    }

    const subcategory = await prismadb.subcategory.updateMany({
      where: {
        id: params.subcategoryId,
      },
      data: {
        name,
        categoryId,
      },
    });

    return NextResponse.json(subcategory);
  } catch (error) {
    console.log('[SUBCATEGORY_PATCH]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { storeId: string; subcategoryId: string } }) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse('Neautentifikuota', { status: 401 });
    }
    if (!params.subcategoryId) {
      return new NextResponse('Būtinas subkategorijos ID', { status: 400 });
    }

    const storeByUserId = await getStoreByUserId(params.storeId, userId);

    if (!storeByUserId) {
      return new NextResponse('Neautorizuota', { status: 403 });
    }

    const subcategory = await prismadb.subcategory.deleteMany({
      where: {
        id: params.subcategoryId,
        category: {
          storeId: params.storeId,
        },
      },
    });

    if (subcategory.count === 0) {
      return new NextResponse('Subkategorija šioje parduotuvėje nerasta', { status: 404 });
    }

    return NextResponse.json(subcategory);
  } catch (error) {
    console.log('[SUBCATEGORY_DELETE]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
