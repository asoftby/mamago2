/** Intake limits (forward-to-plan spec v1.3, section 13). One place on purpose. */
export const CAPTURE_LIMITS = {
  maxTextChars: 4000,
  maxPhotoBytes: 3 * 1024 * 1024,
  maxPhotosPerItem: 3,
  /** Per-owner image quota across singles and albums (rolling 24h). */
  maxPhotosPer24h: 6,
  /** Bot-wide protection against many linked accounts (per environment, rolling 24h). */
  maxItemsAcrossUsersPer24h: 1000,
  maxItemsPer24h: 15,
  rateWindowMs: 24 * 60 * 60 * 1000,
  /** Album debounce: wait after the last update of a media group. */
  albumDebounceMs: 2500,
  /** Max random delay added before trying to claim an item. */
  claimJitterMaxMs: 150,
  /** InboxItem.purgeAfter = createdAt + 7 days. */
  purgeAfterMs: 7 * 24 * 60 * 60 * 1000,
} as const;
