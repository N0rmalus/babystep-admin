type ReleaseOrderBatchOptions = {
  findOrderIds: () => Promise<string[]>;
  release: (orderId: string) => Promise<boolean>;
  onReleaseError: (error: unknown, orderId: string) => void;
  onLookupError?: (error: unknown) => void;
};

export const releaseOrderBatch = async ({
  findOrderIds,
  release,
  onReleaseError,
  onLookupError,
}: ReleaseOrderBatchOptions): Promise<number> => {
  const orderIds = await findOrderIdsReporting({ findOrderIds, onLookupError });
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

const findOrderIdsReporting = async ({
  findOrderIds,
  onLookupError,
}: Pick<ReleaseOrderBatchOptions, 'findOrderIds' | 'onLookupError'>) => {
  if (!onLookupError) {
    return findOrderIds();
  }

  try {
    return await findOrderIds();
  } catch (error) {
    onLookupError(error);

    return [];
  }
};
