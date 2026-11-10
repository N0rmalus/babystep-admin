type ReleaseOrderBatchOptions = {
  findOrderIds: () => Promise<string[]>;
  release: (orderId: string) => Promise<boolean>;
  onReleaseError: (error: unknown, orderId: string) => void;
};

export const releaseOrderBatch = async ({
  findOrderIds,
  release,
  onReleaseError,
}: ReleaseOrderBatchOptions): Promise<number> => {
  const orderIds = await findOrderIds();
  let releasedCount = 0;

  for (const orderId of orderIds) {
    try {
      if (await release(orderId)) {
        releasedCount += 1;
      }
    } catch (error) {
      onReleaseError(error, orderId);
    }
  }

  return releasedCount;
};
