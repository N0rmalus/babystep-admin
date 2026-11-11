const ADMIN_USER_IDS_SEPARATOR = ',';

type IsAdminUserOptions = {
  userId: string;
  // Raw ADMIN_USER_IDS value: comma-separated Clerk user IDs
  adminUserIds: string | undefined;
};

// Fails closed: an unset or empty list lets nobody in
export const isAdminUser = ({ userId, adminUserIds }: IsAdminUserOptions): boolean => {
  if (!adminUserIds) {
    return false;
  }

  return adminUserIds
    .split(ADMIN_USER_IDS_SEPARATOR)
    .map((id) => id.trim())
    .some((id) => id !== '' && id === userId);
};
