import { describe, expect, it } from 'vitest';
import { formatDateTimeLocalValue, getEndedSaleWindow } from './sale-form';

const NOW = new Date(2026, 10, 9, 14, 5, 30);

describe('formatDateTimeLocalValue', () => {
  it('formats a date in local time to minutes', () => {
    expect(formatDateTimeLocalValue(NOW)).toBe('2026-11-09T14:05');
  });

  it('returns null for empty or invalid values', () => {
    expect(formatDateTimeLocalValue(null)).toBeNull();
    expect(formatDateTimeLocalValue('')).toBeNull();
    expect(formatDateTimeLocalValue('not a date')).toBeNull();
  });
});

describe('getEndedSaleWindow', () => {
  it('ends a running sale now and keeps its start', () => {
    expect(getEndedSaleWindow({ saleStartsAt: '2026-11-01T09:00', now: NOW })).toEqual({
      saleStartsAt: '2026-11-01T09:00',
      saleEndsAt: '2026-11-09T14:05',
    });
  });

  it('ends a sale without a start date now', () => {
    expect(getEndedSaleWindow({ saleStartsAt: null, now: NOW })).toEqual({
      saleStartsAt: null,
      saleEndsAt: '2026-11-09T14:05',
    });
  });

  it('moves a future start to now so the scheduled sale never runs', () => {
    expect(getEndedSaleWindow({ saleStartsAt: '2026-12-01T00:00', now: NOW })).toEqual({
      saleStartsAt: '2026-11-09T14:05',
      saleEndsAt: '2026-11-09T14:05',
    });
  });
});
