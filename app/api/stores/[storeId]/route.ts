import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prismadb from '@/lib/prismadb';
import { getNextOrderNumberMessage, NEXT_ORDER_NUMBER_INVALID_MESSAGE } from '@/lib/store-settings';
import { getHighestOrderNumber } from '@/queries/get-highest-order-number';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';

const NAME_REQUIRED_MESSAGE = 'Būtina nurodyti pavadinimą';
const INVALID_BODY_MESSAGE = 'Neteisingi duomenys';

const storePatchSchema = z.object({
  name: z
    .string({ required_error: NAME_REQUIRED_MESSAGE, invalid_type_error: NAME_REQUIRED_MESSAGE })
    .trim()
    .min(1, NAME_REQUIRED_MESSAGE),
  nextOrderNumber: z.number({ invalid_type_error: NEXT_ORDER_NUMBER_INVALID_MESSAGE }).optional(),
});

class NextOrderNumberError extends Error {}

export async function PATCH(req: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Neautentifikuota', { status: 401 });
    }
    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400 });
    }

    const parsed = storePatchSchema.safeParse(await req.json());

    if (!parsed.success) {
      return new NextResponse(parsed.error.issues.at(0)?.message ?? INVALID_BODY_MESSAGE, { status: 400 });
    }

    const store = await getStoreByUserId(params.storeId, userId);

    if (!store) {
      return new NextResponse('Neautorizuota', { status: 403 });
    }

    const { name, nextOrderNumber } = parsed.data;

    const result = await prismadb.$transaction(async (tx) => {
      const nameResult = await tx.store.updateMany({ where: { id: params.storeId, userId }, data: { name } });

      if (nextOrderNumber === undefined) {
        return nameResult;
      }

      const highestOrderNumber = await getHighestOrderNumber(params.storeId, tx);
      const message = getNextOrderNumberMessage({ nextOrderNumber, highestOrderNumber });

      if (message) {
        throw new NextOrderNumberError(message);
      }

      return tx.store.updateMany({ where: { id: params.storeId, userId }, data: { nextOrderNumber } });
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NextOrderNumberError) {
      return new NextResponse(error.message, { status: 400 });
    }

    console.log('[STORE_PATCH]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
// Delete the store function
export async function DELETE(req: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Neautentifikuota', { status: 401 });
    }
    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400 });
    }

    const store = await prismadb.store.deleteMany({
      where: {
        id: params.storeId,
        userId,
      },
    });

    return NextResponse.json(store);
  } catch (error) {
    console.log('[STORE_DELETE]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
