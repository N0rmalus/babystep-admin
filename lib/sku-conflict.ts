import { Prisma } from '@prisma/client';

export const SKU_TAKEN_MESSAGE = 'Toks SKU jau naudojamas kitam šios parduotuvės variantui';

const UNIQUE_CONSTRAINT_ERROR_CODE = 'P2002';
const SKU_FIELD = 'sku';

// True when a write failed on the per-store unique SKU index (ProductVariant @@unique([storeId, sku])).
export const isSkuConflictError = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== UNIQUE_CONSTRAINT_ERROR_CODE) {
    return false;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.includes(SKU_FIELD);
  }

  return typeof target === 'string' && target.includes(SKU_FIELD);
};
