import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/cors';
import prismadb from '@/lib/prismadb';
import { getCategory } from '@/queries/get-category';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';
import { getSubcategories } from '@/queries/get-subcategories';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  try {
    const { userId } = await auth();
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
    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400 });
    }

    const storeByUserId = await getStoreByUserId(params.storeId, userId);

    if (!storeByUserId) {
      return new NextResponse('Neautorizuota', { status: 403 });
    }

    const category = await getCategory(params.storeId, categoryId);

    if (!category) {
      return new NextResponse('Kategorija šiai parduotuvei nerasta', { status: 404 });
    }

    const subcategory = await prismadb.subcategory.create({
      data: {
        name,
        categoryId,
      },
    });

    return NextResponse.json(subcategory);
  } catch (error) {
    console.log('[SUBCATEGORIES_POST]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function GET(req: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  try {
    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400, headers: corsHeaders });
    }

    const subcategories = await getSubcategories(params.storeId, { includeCategory: true });

    return NextResponse.json(subcategories, { headers: corsHeaders });
  } catch (error) {
    console.log('[SUBCATEGORIES_GET]', error);
    return new NextResponse('Internal error', { status: 500, headers: corsHeaders });
  }
}
