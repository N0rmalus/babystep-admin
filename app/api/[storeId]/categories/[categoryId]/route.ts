// Global imports
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/cors';

// Personal imports
import prismadb from '@/lib/prismadb';
import { getBillboard } from '@/queries/get-billboard';
import { getCategory } from '@/queries/get-category';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  req: Request,
  props: { params: Promise<{ storeId: string; categoryId: string }> }
) {
  const params = await props.params;
  try {
    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400, headers: corsHeaders });
    }
    if (!params.categoryId) {
      return new NextResponse('Būtinas kategorijos ID', { status: 400, headers: corsHeaders });
    }

    const category = await getCategory(params.storeId, params.categoryId, { includeBillboard: true });

    if (!category) {
      return new NextResponse('Kategorija šioje parduotuvėje nerasta', { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(category, { headers: corsHeaders });
  } catch (error) {
    console.log('[CATEGORY_GET]', error);
    return new NextResponse('Internal error', { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ storeId: string; categoryId: string }> }
) {
  const params = await props.params;
  try {
    const { userId } = await auth();
    const body = await req.json();

    const { name, billboardId } = body;

    if (!userId) {
      return new NextResponse('Neautentifikuota', { status: 401 });
    }
    if (!name) {
      return new NextResponse('Būtina nurodyti pavadinimą', { status: 400 });
    }
    if (!billboardId) {
      return new NextResponse('Reikalingas skelbimų lentos ID', { status: 400 });
    }
    if (!params.categoryId) {
      return new NextResponse('Būtinas kategorijos ID', { status: 400 });
    }

    const storeByUserId = await getStoreByUserId(params.storeId, userId);

    if (!storeByUserId) {
      return new NextResponse('Neautorizuota', { status: 403 });
    }

    const categoryByStore = await getCategory(params.storeId, params.categoryId);

    if (!categoryByStore) {
      return new NextResponse('Kategorija šioje parduotuvėje nerasta', { status: 404 });
    }

    const billboard = await getBillboard(params.storeId, billboardId);

    if (!billboard) {
      return new NextResponse('Skelbimų lenta šiai parduotuvei nerasta', { status: 404 });
    }

    const category = await prismadb.category.updateMany({
      where: {
        id: params.categoryId,
        storeId: params.storeId,
      },
      data: {
        name,
        billboardId,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.log('[CATEGORY_PATCH]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ storeId: string; categoryId: string }> }
) {
  const params = await props.params;
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Neautentifikuota', { status: 401 });
    }
    if (!params.categoryId) {
      return new NextResponse('Būtinas kategorijos ID', { status: 400 });
    }

    const storeByUserId = await getStoreByUserId(params.storeId, userId);

    if (!storeByUserId) {
      return new NextResponse('Neautorizuota', { status: 403 });
    }

    const category = await prismadb.category.deleteMany({
      where: {
        id: params.categoryId,
        storeId: params.storeId,
      },
    });

    if (category.count === 0) {
      return new NextResponse('Kategorija šioje parduotuvėje nerasta', { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.log('[CATEGORY_DELETE]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
