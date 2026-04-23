// Global imports
import { auth } from '@clerk/nextjs';
import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/cors';

// Personal imports
import prismadb from '@/lib/prismadb';
import { getBillboard } from '@/queries/get-billboard';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request, { params }: { params: { storeId: string; billboardId: string } }) {
  try {
    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400, headers: corsHeaders });
    }
    if (!params.billboardId) {
      return new NextResponse('Reikalingas skelbimų lentos ID', { status: 400, headers: corsHeaders });
    }

    const billboard = await getBillboard(params.storeId, params.billboardId);

    if (!billboard) {
      return new NextResponse('Skelbimų lenta šioje parduotuvėje nerasta', { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(billboard, { headers: corsHeaders });
  } catch (error) {
    console.log('[BILLBOARD_GET]', error);
    return new NextResponse('Internal error', { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req: Request, { params }: { params: { storeId: string; billboardId: string } }) {
  try {
    const { userId } = auth();
    const body = await req.json();

    const { label, imageUrl } = body;

    if (!userId) {
      return new NextResponse('Neautentifikuota', { status: 401 });
    }
    if (!label) {
      return new NextResponse('Reikalinga etiketė', { status: 400 });
    }
    if (!imageUrl) {
      return new NextResponse('Būtinas paveikslėlio URL adresas', { status: 400 });
    }
    if (!params.billboardId) {
      return new NextResponse('Reikalingas skelbimų lentos ID', { status: 400 });
    }

    const storeByUserId = await getStoreByUserId(params.storeId, userId);

    if (!storeByUserId) {
      return new NextResponse('Neautorizuota', { status: 403 });
    }

    const billboard = await prismadb.billboard.updateMany({
      where: {
        id: params.billboardId,
        storeId: params.storeId,
      },
      data: {
        label,
        imageUrl,
      },
    });

    if (billboard.count === 0) {
      return new NextResponse('Skelbimų lenta šioje parduotuvėje nerasta', { status: 404 });
    }

    return NextResponse.json(billboard);
  } catch (error) {
    console.log('[BILLBOARD_PATCH]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { storeId: string; billboardId: string } }) {
  try {
    const { userId } = auth();

    if (!userId) {
      return new NextResponse('Neautentifikuota', { status: 401 });
    }
    if (!params.billboardId) {
      return new NextResponse('Reikalingas skelbimų lentos ID', { status: 400 });
    }

    const storeByUserId = await getStoreByUserId(params.storeId, userId);

    if (!storeByUserId) {
      return new NextResponse('Neautorizuota', { status: 403 });
    }

    const billboard = await prismadb.billboard.deleteMany({
      where: {
        id: params.billboardId,
        storeId: params.storeId,
      },
    });

    if (billboard.count === 0) {
      return new NextResponse('Skelbimų lenta šioje parduotuvėje nerasta', { status: 404 });
    }

    return NextResponse.json(billboard);
  } catch (error) {
    console.log('[BILLBOARD_DELETE]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
