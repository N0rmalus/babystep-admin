import { describe, expect, it } from 'vitest';

import { scrubRequestData } from '@/lib/sentry-scrub';

describe('scrubRequestData', () => {
  it('drops the request body and query string but keeps the rest of the request', () => {
    const event = {
      message: 'Checkout failed',
      request: {
        url: 'https://admin.example/api/store/checkout',
        method: 'POST',
        data: { contact: { email: 'ona@pastas.lt' } },
        query_string: 'token=secret',
      },
    };

    const { request } = scrubRequestData(event);

    expect(request).toEqual({ url: 'https://admin.example/api/store/checkout', method: 'POST' });
    expect(request).not.toHaveProperty('data', expect.anything());
    expect(request).not.toHaveProperty('query_string', expect.anything());
  });

  it('leaves an event without a request unchanged', () => {
    const event = { message: 'No request', request: undefined };

    expect(scrubRequestData(event)).toBe(event);
  });
});
