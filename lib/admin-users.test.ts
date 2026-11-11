import { describe, expect, it } from 'vitest';

import { isAdminUser } from '@/lib/admin-users';

const ADMIN_ID = 'user_admin';

describe('isAdminUser', () => {
  it('accepts a user listed in ADMIN_USER_IDS', () => {
    expect(isAdminUser({ userId: ADMIN_ID, adminUserIds: ADMIN_ID })).toBe(true);
  });

  it('accepts any listed user, ignoring spaces around the commas', () => {
    expect(isAdminUser({ userId: ADMIN_ID, adminUserIds: 'user_other , user_admin ,' })).toBe(true);
  });

  it('rejects a user who is not listed', () => {
    expect(isAdminUser({ userId: 'user_stranger', adminUserIds: `${ADMIN_ID},user_other` })).toBe(false);
  });

  it('does not match a partial ID', () => {
    expect(isAdminUser({ userId: 'user_adm', adminUserIds: ADMIN_ID })).toBe(false);
  });

  it.each([[undefined], [''], [' , ']])('lets nobody in when the list is empty (%j)', (adminUserIds) => {
    expect(isAdminUser({ userId: ADMIN_ID, adminUserIds })).toBe(false);
  });
});
