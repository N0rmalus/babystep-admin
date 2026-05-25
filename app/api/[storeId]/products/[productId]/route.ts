// Global imports
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/cors';

// Personal imports
import prismadb from '@/lib/prismadb';
import {
  getProductSaleValidationMessage,
  hasSubmittedValue,
  normalizeOptionalDate,
  normalizeOptionalPrice,
} from '@/lib/product-pricing';
import { getProduct } from '@/queries/get-product';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';
import { getSubcategory } from '@/queries/get-subcategory';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request, props: { params: Promise<{ storeId: string; productId: string }> }) {
  const params = await props.params;
  try {
    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400, headers: corsHeaders });
    }
    if (!params.productId) {
      return new NextResponse('Būtinas prekės ID', { status: 400, headers: corsHeaders });
    }

    const product = await getProduct(params.storeId, params.productId, {
      includeImages: true,
      includeSubcategoryCategory: true,
    });

    if (!product) {
      return new NextResponse('Prekė nerasta', { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(product, { headers: corsHeaders });
  } catch (error) {
    console.log('[PRODUCT_GET]', error);
    return new NextResponse('Internal error', { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req: Request, props: { params: Promise<{ storeId: string; productId: string }> }) {
  const params = await props.params;
  try {
    const { userId } = await auth();
    const body = await req.json();

    const {
      name,
      price,
      salePrice,
      saleStartsAt,
      saleEndsAt,
      amountInStock,
      subcategoryId,
      images,
      isFeatured,
      isArchived,
      description,
    } = body;
    const normalizedPrice = normalizeOptionalPrice(price);
    const normalizedSalePrice = normalizeOptionalPrice(salePrice);
    const normalizedSaleStartsAt = normalizeOptionalDate(saleStartsAt);
    const normalizedSaleEndsAt = normalizeOptionalDate(saleEndsAt);

    if (!userId) {
      return new NextResponse('Neautentifikuota', { status: 401 });
    }
    if (!name) {
      return new NextResponse('Būtina nurodyti pavadinimą', { status: 400 });
    }
    if (!images || !images.length) {
      return new NextResponse('Reikalingi vaizdai', { status: 400 });
    }
    if (normalizedPrice === null || normalizedPrice <= 0) {
      return new NextResponse('Reikalinga kaina', { status: 400 });
    }
    if (hasSubmittedValue(salePrice) && normalizedSalePrice === null) {
      return new NextResponse('Neteisinga akcijos kaina', { status: 400 });
    }
    if (hasSubmittedValue(saleStartsAt) && normalizedSaleStartsAt === null) {
      return new NextResponse('Neteisinga akcijos pradžios data', { status: 400 });
    }
    if (hasSubmittedValue(saleEndsAt) && normalizedSaleEndsAt === null) {
      return new NextResponse('Neteisinga akcijos pabaigos data', { status: 400 });
    }
    const saleValidationMessage = getProductSaleValidationMessage({
      price: normalizedPrice,
      salePrice: normalizedSalePrice,
      saleStartsAt: normalizedSaleStartsAt,
      saleEndsAt: normalizedSaleEndsAt,
    });

    if (saleValidationMessage) {
      return new NextResponse(saleValidationMessage, { status: 400 });
    }
    if (amountInStock === undefined || amountInStock === null) {
      return new NextResponse('Reikalingas kiekis sandėlyje', { status: 400 });
    }
    if (!subcategoryId) {
      return new NextResponse('Būtinas subkategorijos ID', { status: 400 });
    }
    if (!params.productId) {
      return new NextResponse('Būtinas prekės ID', { status: 400 });
    }

    const storeByUserId = await getStoreByUserId(params.storeId, userId);

    if (!storeByUserId) {
      return new NextResponse('Neautorizuota', { status: 403 });
    }

    const productByStore = await getProduct(params.storeId, params.productId);

    if (!productByStore) {
      return new NextResponse('Prekė šioje parduotuvėje nerasta', { status: 404 });
    }

    const subcategory = await getSubcategory(params.storeId, subcategoryId);

    if (!subcategory) {
      return new NextResponse('Subkategorija šiai parduotuvei nerasta', { status: 404 });
    }

    await prismadb.product.update({
      where: {
        id: params.productId,
      },
      data: {
        name,
        price: normalizedPrice,
        salePrice: normalizedSalePrice,
        saleStartsAt: normalizedSaleStartsAt,
        saleEndsAt: normalizedSaleEndsAt,
        amountInStock,
        subcategoryId,
        images: {
          deleteMany: {},
        },
        isFeatured,
        isArchived,
        description,
      },
    });

    const product = await prismadb.product.update({
      where: {
        id: params.productId,
      },
      data: {
        images: {
          createMany: {
            data: [...images.map((image: { url: string }) => image)],
          },
        },
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.log('[PRODUCT_PATCH]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ storeId: string; productId: string }> }) {
  const params = await props.params;
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Neautentifikuota', { status: 401 });
    }
    if (!params.productId) {
      return new NextResponse('Būtinas prekės ID', { status: 400 });
    }

    const storeByUserId = await getStoreByUserId(params.storeId, userId);

    if (!storeByUserId) {
      return new NextResponse('Neautorizuota', { status: 403 });
    }

    const product = await prismadb.product.deleteMany({
      where: {
        id: params.productId,
        storeId: params.storeId,
      },
    });

    if (product.count === 0) {
      return new NextResponse('Prekė šioje parduotuvėje nerasta', { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.log('[PRODUCT_DELETE]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
