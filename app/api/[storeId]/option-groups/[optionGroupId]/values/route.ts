import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { HEX_REQUIRED_MESSAGE, parseSizeValueInput } from '@/lib/option-group';
import prismadb from '@/lib/prismadb';
import { getOptionGroup } from '@/queries/get-option-group';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';

type RouteProps = { params: Promise<{ storeId: string; optionGroupId: string }> };

const SIZE_GROUP_NOT_FOUND_MESSAGE = 'Dydžio savybė šioje parduotuvėje nerasta';
const INTERNAL_ERROR_MESSAGE = 'Vidinė serverio klaida';

// "+ Naujas dydis" in the product form: appends a store-level value to the size-role group (shown on Savybės).
export async function POST(req: Request, props: RouteProps) {
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

    // Store-level groups only; the size role is recognised by role, not by name
    const optionGroup = await getOptionGroup(params.storeId, params.optionGroupId);

    if (!optionGroup || optionGroup.role !== 'SIZE') {
      return new NextResponse(SIZE_GROUP_NOT_FOUND_MESSAGE, { status: 404 });
    }

    // A swatch value needs a hex colour, which only the Savybės page asks for
    if (optionGroup.displayType === 'SWATCH') {
      return new NextResponse(HEX_REQUIRED_MESSAGE, { status: 400 });
    }

    const input = parseSizeValueInput(
      await req.json(),
      optionGroup.values.map((value) => value.label),
    );

    if (!input.isValid) {
      return new NextResponse(input.message, { status: 400 });
    }

    const lastPosition = optionGroup.values.at(-1)?.position ?? -1;
    const optionValue = await prismadb.optionValue.create({
      data: { groupId: optionGroup.id, label: input.label, position: lastPosition + 1 },
    });

    return NextResponse.json(optionValue);
  } catch (error) {
    console.log('[OPTION_GROUP_VALUES_POST]', error);
    return new NextResponse(INTERNAL_ERROR_MESSAGE, { status: 500 });
  }
}
