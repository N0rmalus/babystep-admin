import { auth } from '@clerk/nextjs';
import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/cors';
import prismadb from '@/lib/prismadb';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const { userId } = auth();
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

    const category = await prismadb.category.create({
      data: {
        name,
        billboardId,
        storeId: params.storeId,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.log('[CATEGORIES_POST]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: { storeId: string } }) {
  try {
    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400, headers: corsHeaders });
    }

    const categories = await prismadb.category.findMany({
      where: {
        storeId: params.storeId,
      },
    });

    return NextResponse.json(categories, { headers: corsHeaders });
  } catch (error) {
    console.log('[CATEGORIES_GET]', error);
    return new NextResponse('Internal error', { status: 500, headers: corsHeaders });
  }
}
