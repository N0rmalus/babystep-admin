// Global imports
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Personal imports
import { isAdminUser } from '@/lib/admin-users';
import { DEFAULT_OPTION_GROUPS } from '@/lib/default-option-groups';
import prismadb from '@/lib/prismadb';

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Neautorizuota', { status: 401 });
    }
    if (!isAdminUser({ userId, adminUserIds: process.env.ADMIN_USER_IDS })) {
      return new NextResponse('Neturite teisės kurti parduotuvės', { status: 403 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name) {
      return new NextResponse('Būtina nurodyti pavadinimą', { status: 400 });
    }

    const store = await prismadb.store.create({
      data: {
        name,
        userId,
        optionGroups: {
          createMany: {
            data: [...DEFAULT_OPTION_GROUPS],
          },
        },
      },
    });

    return NextResponse.json(store);
  } catch (error) {
    console.log('[STORE_POST]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
