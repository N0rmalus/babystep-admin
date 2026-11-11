import { NextResponse } from 'next/server';

import { corsHeaders } from '@/lib/cors';
import { getMontonioClient } from '@/lib/montonio-client';
import { getPickupPointsResponse } from '@/lib/storefront-checkout';

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') ?? '';

  return getPickupPointsResponse({ getClient: getMontonioClient, query, limit: searchParams.get('limit') });
}
