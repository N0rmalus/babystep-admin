import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const { auth, create } = vi.hoisted(() => ({
  auth: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth }));
vi.mock('@/lib/prismadb', () => ({ default: { store: { create } } }));

const ADMIN_ID = 'user_admin';

const post = (body: unknown) =>
  POST(new Request('http://localhost/api/stores', { method: 'POST', body: JSON.stringify(body) }));

describe('POST /api/stores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ADMIN_USER_IDS', `user_other,${ADMIN_ID}`);
    auth.mockResolvedValue({ userId: ADMIN_ID });
    create.mockResolvedValue({ id: 'store-1', name: 'Babystep' });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects a signed-out user with 401', async () => {
    auth.mockResolvedValue({ userId: null });

    const response = await post({ name: 'Babystep' });

    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a signed-in user who is not in ADMIN_USER_IDS with 403', async () => {
    auth.mockResolvedValue({ userId: 'user_stranger' });

    const response = await post({ name: 'Babystep' });

    expect(response.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects everyone with 403 when ADMIN_USER_IDS is not set', async () => {
    vi.stubEnv('ADMIN_USER_IDS', undefined);

    const response = await post({ name: 'Babystep' });

    expect(response.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a missing name with 400', async () => {
    const response = await post({});

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the store for an admin', async () => {
    const response = await post({ name: 'Babystep' });

    expect(response.status).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Babystep', userId: ADMIN_ID }) }),
    );
  });
});
