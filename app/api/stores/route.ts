// Global imports
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Personal imports
import prismadb from '@/lib/prismadb';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    const body = await req.json();

    const { name } = body;

    if (!userId) {
      return new NextResponse('Neautorizuota', { status: 401 });
    }
    if (!name) {
      return new NextResponse('Būtina nurodyti pavadinimą', { status: 400 });
    }

    const store = await prismadb.store.create({
      data: {
        name,
        userId,
      },
    });

    return NextResponse.json(store);
  } catch (error) {
    console.log('[STORE_POST]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
