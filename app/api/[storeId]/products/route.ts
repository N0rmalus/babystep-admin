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
import { getProductCatalog, type ProductCatalogSort } from '@/queries/get-product-catalog';
import { getProducts } from '@/queries/get-products';
import { getStoreByUserId } from '@/queries/get-store-by-user-id';
import { getSubcategory } from '@/queries/get-subcategory';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

const getOptionalParam = (value: string | null) => {
  return value?.trim() || undefined;
};

const getCsvParamValues = (value: string | null) => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const getBooleanParam = (value: string | null) => {
  return value === '1' || value === 'true';
};

const getNumberParam = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return undefined;
  }

  return numberValue;
};

const getIntegerParam = (value: string | null) => {
  const numberValue = getNumberParam(value);

  if (numberValue === undefined) {
    return undefined;
  }

  return Math.floor(numberValue);
};

const getCatalogSortParam = (value: string | null): ProductCatalogSort | undefined => {
  if (value === 'price-asc' || value === 'price-desc' || value === 'name-asc' || value === 'recommended') {
    return value;
  }

  return undefined;
};

export async function POST(req: Request, props: { params: Promise<{ storeId: string }> }) {
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
    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400 });
    }

    const storeByUserId = await getStoreByUserId(params.storeId, userId);

    if (!storeByUserId) {
      return new NextResponse('Neautorizuota', { status: 403 });
    }

    const subcategory = await getSubcategory(params.storeId, subcategoryId);

    if (!subcategory) {
      return new NextResponse('Subkategorija šiai parduotuvei nerasta', { status: 404 });
    }

    const product = await prismadb.product.create({
      data: {
        name,
        price: normalizedPrice,
        salePrice: normalizedSalePrice,
        saleStartsAt: normalizedSaleStartsAt,
        saleEndsAt: normalizedSaleEndsAt,
        amountInStock,
        subcategoryId,
        isFeatured,
        isArchived,
        description,
        storeId: params.storeId,
        images: {
          createMany: {
            data: [...images.map((image: { url: string }) => image)],
          },
        },
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.log('[PRODUCTS_POST]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function GET(req: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = getOptionalParam(searchParams.get('categoryId'));
    const subcategoryId = getOptionalParam(searchParams.get('subcategoryId'));
    const isFeatured = getBooleanParam(searchParams.get('isFeatured'));
    const isOnSale = getBooleanParam(searchParams.get('isOnSale'));

    if (!params.storeId) {
      return new NextResponse('Būtinas parduotuvės ID', { status: 400, headers: corsHeaders });
    }

    if (getBooleanParam(searchParams.get('includeCatalog'))) {
      const catalog = await getProductCatalog(params.storeId, {
        categoryId,
        subcategoryId,
        baseIsOnSale: getBooleanParam(searchParams.get('baseOnSale')),
        subcategoryIds: getCsvParamValues(searchParams.get('subcategoryIds')),
        query: getOptionalParam(searchParams.get('q')),
        minPrice: getNumberParam(searchParams.get('minPrice')),
        maxPrice: getNumberParam(searchParams.get('maxPrice')),
        isInStock: getBooleanParam(searchParams.get('inStock')),
        isOnSale: getBooleanParam(searchParams.get('onSale')),
        sort: getCatalogSortParam(searchParams.get('sort')),
        page: getIntegerParam(searchParams.get('page')),
        pageSize: getIntegerParam(searchParams.get('pageSize')),
      });

      return NextResponse.json(catalog, { headers: corsHeaders });
    }

    const products = await getProducts(params.storeId, {
      categoryId,
      subcategoryId,
      isFeatured: isFeatured ? true : undefined,
      isOnSale: isOnSale ? true : undefined,
      onlyActive: true,
      includeImages: true,
      includeSubcategoryCategory: true,
    });

    return NextResponse.json(products, { headers: corsHeaders });
  } catch (error) {
    console.log('[PRODUCTS_GET]', error);
    return new NextResponse('Internal error', { status: 500, headers: corsHeaders });
  }
}
