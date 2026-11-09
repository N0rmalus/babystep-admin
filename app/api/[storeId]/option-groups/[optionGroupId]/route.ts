import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/cors';
import { Prisma } from '@prisma/client';
import {
  USED_VALUES_FALLBACK_MESSAGE,
  getUsedValuesMessage,
  parseOptionGroupInput,
  planOptionValueChanges,
} from '@/lib/option-group';
import prismadb from '@/lib/prismadb';
import { getOptionGroup } from '@/queries/get-option-group';
import { ORDERED_OPTION_VALUES } from '@/queries/get-option-groups';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';

type RouteProps = { params: Promise<{ storeId: string; optionGroupId: string }> };

const GROUP_NOT_FOUND_MESSAGE = 'Savybė šioje parduotuvėje nerasta';
const INTERNAL_ERROR_MESSAGE = 'Vidinė serverio klaida';
// Prisma's emulated Restrict (relationMode = "prisma") when a variant still references a deleted value
const RELATION_VIOLATION_ERROR_CODE = 'P2014';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request, props: RouteProps) {
  const params = await props.params;
  try {
    const optionGroup = await getOptionGroup(params.storeId, params.optionGroupId);

    if (!optionGroup) {
      return new NextResponse(GROUP_NOT_FOUND_MESSAGE, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(optionGroup, { headers: corsHeaders });
  } catch (error) {
    console.log('[OPTION_GROUP_GET]', error);
    return new NextResponse(INTERNAL_ERROR_MESSAGE, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req: Request, props: RouteProps) {
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

    const optionGroup = await getOptionGroup(params.storeId, params.optionGroupId);

    if (!optionGroup) {
      return new NextResponse(GROUP_NOT_FOUND_MESSAGE, { status: 404 });
    }

    // The group's role, not its name, decides whether values keep size ranges
    const input = parseOptionGroupInput(await req.json(), optionGroup.role);

    if (!input.isValid) {
      return new NextResponse(input.message, { status: 400 });
    }

    const plan = planOptionValueChanges({
      existingValueIds: optionGroup.values.map((value) => value.id),
      values: input.group.values,
    });

    if (!plan.isValid) {
      return new NextResponse(plan.message, { status: 400 });
    }

    const result = await prismadb.$transaction(async (tx) => {
      // Friendly pre-check; a variant added concurrently is caught by Prisma's emulated Restrict (see catch)
      const usedValues = await tx.optionValue.findMany({
        where: {
          id: { in: plan.deleteIds },
          variants: { some: {} },
        },
        select: { label: true },
      });

      if (usedValues.length > 0) {
        return { isSaved: false, usedLabels: usedValues.map((value) => value.label) } as const;
      }

      await tx.optionValue.deleteMany({
        where: { id: { in: plan.deleteIds }, groupId: optionGroup.id },
      });

      for (const { id, ...value } of plan.updates) {
        await tx.optionValue.update({ where: { id }, data: value });
      }

      const savedGroup = await tx.optionGroup.update({
        where: { id: optionGroup.id },
        data: {
          name: input.group.name,
          displayType: input.group.displayType,
          values: {
            create: plan.creates,
          },
        },
        include: {
          values: ORDERED_OPTION_VALUES,
        },
      });

      return { isSaved: true, optionGroup: savedGroup } as const;
    });

    if (!result.isSaved) {
      return new NextResponse(getUsedValuesMessage(result.usedLabels), { status: 409 });
    }

    return NextResponse.json(result.optionGroup);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === RELATION_VIOLATION_ERROR_CODE) {
      return new NextResponse(USED_VALUES_FALLBACK_MESSAGE, { status: 409 });
    }

    console.log('[OPTION_GROUP_PATCH]', error);
    return new NextResponse(INTERNAL_ERROR_MESSAGE, { status: 500 });
  }
}
