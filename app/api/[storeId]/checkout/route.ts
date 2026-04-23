import Stripe from 'stripe';
import { NextResponse } from 'next/server';

import { corsHeaders } from '@/lib/cors';
import { stripe } from '@/lib/stripe';
import prismadb from '@/lib/prismadb';
import { getProducts } from '@/queries/get-products';

type CheckoutRequest = {
  productIds?: string[];
};

const buildQuantityByProductId = (productIds: string[]) => {
  return productIds.reduce<Record<string, number>>((accumulator, productId) => {
    accumulator[productId] = (accumulator[productId] ?? 0) + 1;
    return accumulator;
  }, {});
};

const jsonResponse = (body: unknown, status: number) => {
  return NextResponse.json(body, {
    status,
    headers: corsHeaders,
  });
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request, { params }: { params: { storeId: string } }) {
  try {
    const body = (await req.json()) as CheckoutRequest;
    const productIds = body?.productIds;

    if (!params.storeId) {
      return jsonResponse({ message: 'Būtinas parduotuvės ID' }, 400);
    }

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return jsonResponse({ message: 'Būtina nurodyti prekių ID' }, 400);
    }

    const sanitizedProductIds = productIds.filter(
      (productId): productId is string => typeof productId === 'string' && productId.trim().length > 0,
    );

    if (sanitizedProductIds.length !== productIds.length) {
      return jsonResponse({ message: 'Neteisingas prekių sąrašas' }, 400);
    }

    const quantityByProductId = buildQuantityByProductId(sanitizedProductIds);
    const uniqueProductIds = Object.keys(quantityByProductId);

    const products = await getProducts(params.storeId, {
      productIds: uniqueProductIds,
      onlyActive: true,
      selectCheckoutFields: true,
    });

    const availableProductIds = new Set(products.map((product) => product.id));
    const invalidProductIds = uniqueProductIds.filter((productId) => !availableProductIds.has(productId));

    if (invalidProductIds.length > 0) {
      return jsonResponse(
        {
          message: 'Kai kurios prekės nebegalimos įsigyti',
          invalidProductIds,
        },
        400,
      );
    }

    const insufficientStockItems = products
      .map((product) => ({
        productId: product.id,
        requested: quantityByProductId[product.id],
        available: product.amountInStock,
      }))
      .filter((item) => item.requested > item.available);

    if (insufficientStockItems.length > 0) {
      return jsonResponse(
        {
          message: 'Kai kurių prekių kiekis sandėlyje pasikeitė',
          insufficientStockItems,
        },
        400,
      );
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = products.map((product) => ({
      quantity: quantityByProductId[product.id],
      price_data: {
        currency: 'EUR',
        product_data: {
          name: product.name,
        },
        unit_amount: Math.round(product.price.toNumber() * 100),
      },
    }));

    const order = await prismadb.order.create({
      data: {
        storeId: params.storeId,
        isPaid: false,
        orderItems: {
          create: sanitizedProductIds.map((productId) => ({
            product: {
              connect: {
                id: productId,
              },
            },
          })),
        },
      },
    });

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: 'payment',
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true,
      },
      success_url: `${process.env.FRONTEND_STORE_URL}/cart?success=1`,
      cancel_url: `${process.env.FRONTEND_STORE_URL}/cart?canceled=1`,
      metadata: {
        orderId: order.id,
      },
    });

    return jsonResponse({ url: session.url }, 200);
  } catch (error) {
    console.log('[CHECKOUT_POST]', error);
    return jsonResponse({ message: 'Internal error' }, 500);
  }
}
