import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PATCH } from './route';

const { auth, getStoreByUserId, updateMany } = vi.hoisted(() => ({
  auth: vi.fn(),
  getStoreByUserId: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth }));
vi.mock('@/queries/get-store-by-user-id', () => ({ getStoreByUserId }));
vi.mock('@/lib/prismadb', () => ({ default: { order: { updateMany } } }));

const STORE_ID = 'store-1';
const ORDER_ID = 'order-1';
const OWNER_ID = 'user-owner';

const patch = (body: unknown) =>
  PATCH(new Request('http://localhost/api', { method: 'PATCH', body: JSON.stringify(body) }), {
    params: Promise.resolve({ storeId: STORE_ID, orderId: ORDER_ID }),
  });

describe('PATCH /api/[storeId]/orders/[orderId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue({ userId: OWNER_ID });
    getStoreByUserId.mockImplementation(async (_storeId: string, userId: string) =>
      userId === OWNER_ID ? { id: STORE_ID } : null,
    );
    updateMany.mockResolvedValue({ count: 1 });
  });

  it('rejects a signed-out user with 401', async () => {
    auth.mockResolvedValue({ userId: null });

    const response = await patch({ needsReview: false });

    expect(response.status).toBe(401);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('rejects a user who does not own the store with 403', async () => {
    auth.mockResolvedValue({ userId: 'user-other' });

    const response = await patch({ needsReview: false });

    expect(response.status).toBe(403);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('marks the order as resolved for the owner, keeping the review reason', async () => {
    const response = await patch({ needsReview: false });

    expect(response.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: ORDER_ID, storeId: STORE_ID },
      data: { needsReview: false },
    });
  });

  it.each([[{}], [{ needsReview: true }], [{ needsReview: false, reviewReason: null }]])(
    'rejects an update other than resolving the review (%j) with 400',
    async (body) => {
      const response = await patch(body);

      expect(response.status).toBe(400);
      expect(updateMany).not.toHaveBeenCalled();
    },
  );

  it('answers 404 when the order is not in the store', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    const response = await patch({ needsReview: false });

    expect(response.status).toBe(404);
  });
});
