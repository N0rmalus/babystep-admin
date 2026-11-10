import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { releaseExpiredOrders } from '@/lib/reservation';

const HTTP_UNAUTHORIZED = 401;
const HTTP_INTERNAL_ERROR = 500;

export async function POST(req: Request) {
  if (!isCronRequestAuthorized({ req, secret: process.env.CRON_SECRET })) {
    return new NextResponse('Neautentifikuota', { status: HTTP_UNAUTHORIZED });
  }

  try {
    const releasedCount = await releaseExpiredOrders();

    return NextResponse.json({ releasedCount });
  } catch (error) {
    Sentry.captureException(error);
    console.log('[CRON_RELEASE_RESERVATIONS_POST]', error);

    return new NextResponse('Internal error', { status: HTTP_INTERNAL_ERROR });
  }
}
