import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/cors';
import { parseOptionGroupInput, pickSizeFields } from '@/lib/option-group';
import prismadb from '@/lib/prismadb';
import { getOptionGroups, ORDERED_OPTION_VALUES } from '@/queries/get-option-groups';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';

const INTERNAL_ERROR_MESSAGE = 'Vidinė serverio klaida';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Neautentifikuota', { status: 401 });
    }

    const storeByUserId = await getStoreByUserId(params.storeId, userId);

    if (!storeByUserId) {
      return new NextResponse('Neautorizuota', { status: 403 });
    }

    // New groups never get the size role; only the seeded Dydis group has it
    const input = parseOptionGroupInput(await req.json(), 'NONE');

    if (!input.isValid) {
      return new NextResponse(input.message, { status: 400 });
    }

    const lastGroup = await prismadb.optionGroup.findFirst({
      where: { storeId: params.storeId, productId: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const optionGroup = await prismadb.optionGroup.create({
      data: {
        storeId: params.storeId,
        name: input.group.name,
        displayType: input.group.displayType,
        position: lastGroup ? lastGroup.position + 1 : 0,
        values: {
          create: input.group.values.map((value, position) => ({
            label: value.label,
            hex: value.hex,
            ...pickSizeFields(value),
            position,
          })),
        },
      },
      include: {
        values: ORDERED_OPTION_VALUES,
      },
    });

    return NextResponse.json(optionGroup);
  } catch (error) {
    console.log('[OPTION_GROUPS_POST]', error);
    return new NextResponse(INTERNAL_ERROR_MESSAGE, { status: 500 });
  }
}

export async function GET(req: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  try {
    const optionGroups = await getOptionGroups(params.storeId);

    return NextResponse.json(optionGroups, { headers: corsHeaders });
  } catch (error) {
    console.log('[OPTION_GROUPS_GET]', error);
    return new NextResponse(INTERNAL_ERROR_MESSAGE, { status: 500, headers: corsHeaders });
  }
}
