import { describe, expect, it } from 'vitest';

import { getReleaseCutoff, getReservationExpiresAt } from '@/lib/reservation-config';

describe('getReservationExpiresAt', () => {
  it('holds the reservation for 30 minutes', () => {
    expect(getReservationExpiresAt(new Date('2026-11-10T12:00:00.000Z'))).toEqual(new Date('2026-11-10T12:30:00.000Z'));
  });
});

describe('getReleaseCutoff', () => {
  it('releases orders whose expiresAt is more than 10 minutes in the past', () => {
    expect(getReleaseCutoff(new Date('2026-11-10T12:40:00.000Z'))).toEqual(new Date('2026-11-10T12:30:00.000Z'));
  });
});
