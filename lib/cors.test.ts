import { describe, expect, it } from 'vitest';

import { getCorsHeaders } from '@/lib/cors';

describe('getCorsHeaders', () => {
  it('allows only the storefront origin and the methods it uses', () => {
    expect(getCorsHeaders('https://babystep.lt/')).toEqual({
      'Access-Control-Allow-Origin': 'https://babystep.lt',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
  });

  it('strips a path from the store URL', () => {
    expect(getCorsHeaders('http://localhost:3001/lt')).toMatchObject({
      'Access-Control-Allow-Origin': 'http://localhost:3001',
    });
  });

  it.each([
    ['a missing URL', undefined],
    ['an empty URL', ''],
    ['an invalid URL', 'not a url'],
  ])('allows no origin for %s', (_, storeUrl) => {
    expect(getCorsHeaders(storeUrl)).not.toHaveProperty('Access-Control-Allow-Origin');
  });
});
