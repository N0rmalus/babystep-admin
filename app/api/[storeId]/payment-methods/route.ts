import { NextResponse } from 'next/server';

import { corsHeaders } from '@/lib/cors';
import { getMontonioClient } from '@/lib/montonio-client';
import { getPaymentMethodsResponse } from '@/lib/storefront-checkout';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  return getPaymentMethodsResponse(getMontonioClient);
}
