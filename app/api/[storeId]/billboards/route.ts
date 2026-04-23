// Global imports
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/cors';

// Personal imports
import prismadb from '@/lib/prismadb';
import { getBillboards } from '@/queries/get-billboards';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  try {
    const { userId } = await auth();
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
    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400 });
    }

    const storeByUserId = await getStoreByUserId(params.storeId, userId);

    if (!storeByUserId) {
      return new NextResponse('Neautorizuota', { status: 403 });
    }

    const billboard = await prismadb.billboard.create({
      data: {
        label,
        imageUrl,
        storeId: params.storeId,
      },
    });

    return NextResponse.json(billboard);
  } catch (error) {
    console.log('[BILLBOARDS_POST]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function GET(req: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  try {
    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400, headers: corsHeaders });
    }

    const billboards = await getBillboards(params.storeId);

    return NextResponse.json(billboards, { headers: corsHeaders });
  } catch (error) {
    console.log('[BILLBOARDS_GET]', error);
    return new NextResponse('Internal error', { status: 500, headers: corsHeaders });
  }
}
