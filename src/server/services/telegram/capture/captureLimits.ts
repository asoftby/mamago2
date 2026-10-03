/** Intake limits (forward-to-plan spec v1.3, section 13). One place on purpose. */
export const CAPTURE_LIMITS = {
  maxTextChars: 4000,
  maxPhotoBytes: 5 * 1024 * 1024,
  maxPhotosPerItem: 5,
  maxItemsPer24h: 30,
  rateWindowMs: 24 * 60 * 60 * 1000,
  /** Album debounce: wait after the last update of a media group. */
  albumDebounceMs: 2500,
  /** Max random delay added before trying to claim an item. */
  claimJitterMaxMs: 150,
  /** InboxItem.purgeAfter = createdAt + 7 days. */
  purgeAfterMs: 7 * 24 * 60 * 60 * 1000,
} as const;
