import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireStoreOwner } from '@/lib/require-store-owner';

const { auth, getStoreByUserId, redirect } = vi.hoisted(() => ({
  auth: vi.fn(),
  getStoreByUserId: vi.fn(),
  // Next's redirect() throws to stop rendering; mirror that so code after it never runs
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
}));

vi.mock('server-only', () => ({}));
vi.mock('@clerk/nextjs/server', () => ({ auth }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/queries/get-store-by-user-id', () => ({ getStoreByUserId }));

const STORE_ID = 'store-1';
const OWNER_ID = 'user-owner';
const STORE = { id: STORE_ID, userId: OWNER_ID };

describe('requireStoreOwner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ userId: OWNER_ID });
    getStoreByUserId.mockImplementation(async (storeId: string, userId: string) =>
      storeId === STORE_ID && userId === OWNER_ID ? STORE : null,
    );
  });

  it('sends a signed-out user to sign-in without looking up the store', async () => {
    auth.mockResolvedValue({ userId: null });

    await expect(requireStoreOwner(STORE_ID)).rejects.toThrow('REDIRECT /sign-in');
    expect(getStoreByUserId).not.toHaveBeenCalled();
  });

  it('sends a user who does not own the store home', async () => {
    auth.mockResolvedValue({ userId: 'user-other' });

    await expect(requireStoreOwner(STORE_ID)).rejects.toThrow('REDIRECT /');
  });

  it('returns the store for its owner', async () => {
    await expect(requireStoreOwner(STORE_ID)).resolves.toBe(STORE);
    expect(redirect).not.toHaveBeenCalled();
  });
});
