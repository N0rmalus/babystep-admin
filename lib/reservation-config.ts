export const RESERVATION_MINUTES = 30;
export const RELEASE_GRACE_MINUTES = 10;

const MILLISECONDS_PER_MINUTE = 60 * 1000;

export const getReservationExpiresAt = (now: Date): Date =>
  new Date(now.getTime() + RESERVATION_MINUTES * MILLISECONDS_PER_MINUTE);

export const getReleaseCutoff = (now: Date): Date =>
  new Date(now.getTime() - RELEASE_GRACE_MINUTES * MILLISECONDS_PER_MINUTE);
