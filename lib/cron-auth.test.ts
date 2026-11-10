import { describe, expect, it } from 'vitest';

import { isCronRequestAuthorized } from '@/lib/cron-auth';

const SECRET = 'k3J9xQ2vL8mZ4pR7tW1yB6nC5hF0dS';
const CRON_URL = 'http://localhost:3000/api/cron/release-reservations';

const createRequest = ({ authorization, token }: { authorization?: string; token?: string }) => {
  const url = new URL(CRON_URL);

  if (token !== undefined) {
    url.searchParams.set('token', token);
  }

  return new Request(url, { method: 'POST', headers: authorization ? { authorization } : {} });
};

describe('isCronRequestAuthorized', () => {
  it('accepts the secret as a Bearer token', () => {
    expect(isCronRequestAuthorized({ req: createRequest({ authorization: `Bearer ${SECRET}` }), secret: SECRET })).toBe(
      true,
    );
  });

  it('accepts the secret as a ?token= query param', () => {
    expect(isCronRequestAuthorized({ req: createRequest({ token: SECRET }), secret: SECRET })).toBe(true);
  });

  it('rejects a request without a secret', () => {
    expect(isCronRequestAuthorized({ req: createRequest({}), secret: SECRET })).toBe(false);
  });

  it('rejects a wrong Bearer token and a wrong query token', () => {
    expect(isCronRequestAuthorized({ req: createRequest({ authorization: 'Bearer wrong' }), secret: SECRET })).toBe(
      false,
    );
    expect(isCronRequestAuthorized({ req: createRequest({ token: `${SECRET}x` }), secret: SECRET })).toBe(false);
  });

  it('rejects the secret without the Bearer scheme', () => {
    expect(isCronRequestAuthorized({ req: createRequest({ authorization: SECRET }), secret: SECRET })).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    expect(isCronRequestAuthorized({ req: createRequest({ authorization: 'Bearer ' }), secret: undefined })).toBe(
      false,
    );
    expect(isCronRequestAuthorized({ req: createRequest({ token: '' }), secret: '' })).toBe(false);
  });
});
