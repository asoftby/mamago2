import type { ManualRedirect, RedirectRule, UnmatchedUrl } from "../domain/types";

export const MOCK_AUTOMATIC_REDIRECTS: RedirectRule[] = [
  {
    id: "ar-1",
    fromUrl: "/old-city/events/123",
    toUrl: "/minsk/kuda/events/123",
    ruleType: "legacy_migration",
    source: "migration:v1-routes",
    enabled: true,
    status: "active",
    lastCheckedAt: "2025-03-22T08:00:00.000Z",
  },
  {
    id: "ar-2",
    fromUrl: "/minsk/go",
    toUrl: "/minsk/kuda",
    ruleType: "preset_mapping",
    source: "config:intent-aliases",
    enabled: true,
    status: "active",
    lastCheckedAt: "2025-03-21T12:30:00.000Z",
  },
  {
    id: "ar-3",
    fromUrl: "/minsk/kuda//double",
    toUrl: "/minsk/kuda",
    ruleType: "slug_normalization",
    source: "middleware:path-normalize",
    enabled: true,
    status: "active",
    lastCheckedAt: "2025-03-20T15:10:00.000Z",
  },
  {
    id: "ar-4",
    fromUrl: "/minsk/classes/krugok",
    toUrl: "/minsk/zanyatiya/krugok",
    ruleType: "category_mapping",
    source: "taxonomy:category-slug-2024",
    enabled: false,
    status: "paused",
    lastCheckedAt: "2025-03-18T09:00:00.000Z",
  },
];

export const MOCK_MANUAL_REDIRECTS: ManualRedirect[] = [
  {
    id: "mr-1",
    from: "/promo/spring",
    to: "/minsk/kuda",
    redirectType: "301",
    note: "Кампания завершена",
    status: "active",
    updatedAt: "2025-03-10T11:20:00.000Z",
  },
  {
    id: "mr-2",
    from: "/tmp/landing",
    to: "/journal",
    redirectType: "302",
    note: null,
    status: "active",
    updatedAt: "2025-02-01T14:00:00.000Z",
  },
];

export const MOCK_UNMATCHED_URLS: UnmatchedUrl[] = [
  {
    id: "um-1",
    legacyUrl: "https://legacy.mamago.by/place/old-slug-99",
    detectedType: "place",
    suggestedTarget: "/minsk/kuda/places/new-slug",
    status: "new",
  },
  {
    id: "um-2",
    legacyUrl: "/events/archive/2001/01",
    detectedType: "unknown",
    suggestedTarget: null,
    status: "new",
  },
  {
    id: "um-3",
    legacyUrl: "/blog/post-old",
    detectedType: "category",
    suggestedTarget: "/journal/semeynye-marshruty",
    status: "reviewed",
  },
];
