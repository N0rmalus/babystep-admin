import Stripe from 'stripe';
import { NextResponse } from 'next/server';

import { buildCheckoutItems } from '@/lib/checkout-items';
import { corsHeaders } from '@/lib/cors';
import { CENTS_PER_EURO } from '@/lib/product-pricing';
import { stripe } from '@/lib/stripe';
import prismadb from '@/lib/prismadb';
import { getProducts } from '@/queries/get-products';

type CheckoutRequest = {
  productIds?: string[];
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

export async function POST(req: Request, props: { params: Promise<{ storeId: string }> }) {
  const params = await props.params;
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

    const products = await getProducts(params.storeId, {
      productIds: [...new Set(sanitizedProductIds)],
      onlyActive: true,
      selectCheckoutFields: true,
    });

    const checkout = buildCheckoutItems({ productIds: sanitizedProductIds, products });

    if (checkout.status === 'unavailable') {
      return jsonResponse(
        {
          message: 'Kai kurios prekės nebegalimos įsigyti',
          invalidProductIds: checkout.invalidProductIds,
        },
        400,
      );
    }

    if (checkout.status === 'insufficient-stock') {
      return jsonResponse(
        {
          message: 'Kai kurių prekių kiekis sandėlyje pasikeitė',
          insufficientStockItems: checkout.insufficientStockItems,
        },
        400,
      );
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = checkout.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: 'EUR',
        product_data: {
          name: item.productName,
        },
        unit_amount: Math.round(item.unitPrice * CENTS_PER_EURO),
      },
    }));

    const order = await prismadb.order.create({
      data: {
        storeId: params.storeId,
        isPaid: false,
        orderItems: {
          create: checkout.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            productName: item.productName,
            sku: item.sku,
            options: [],
            unitPrice: item.unitPrice,
            regularUnitPrice: item.regularUnitPrice,
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
