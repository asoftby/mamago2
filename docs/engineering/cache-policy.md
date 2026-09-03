# mamaGo 2.0 Cache Policy

Status: active engineering policy

## Goal

Use caching to remove repeated reads and improve perceived speed without serving stale private or publication-critical data.

Every new read path should explicitly belong to one of the classes below. Avoid ad-hoc cache lifetimes inside feature code when a shared policy already applies.

## Cache classes

| Class | Typical data | Client | Server / HTTP | Invalidation |
| --- | --- | --- | --- | --- |
| `IMMUTABLE_MEDIA` | Published image bytes with immutable URLs | Browser cache | `public, max-age=31536000, immutable` | New URL on byte change |
| `REFERENCE` | Cities, districts, metro, taxonomy | Reuse/dedupe | 5 min browser, 1 h shared cache, SWR up to 24 h where safe | Admin mutation tag/path invalidation |
| `PUBLIC_CATALOG` | Event/place/offer/article list projections | Optional short client reuse | Short server cache / tags | Publish, moderation, visibility, slug, city and schedule mutations |
| `FAST_PUBLIC` | Weather, stories, time-sensitive projections | Short reuse | 5–30 min depending on source | TTL plus mutation tags when first-party |
| `PRIVATE_SESSION` | Plan, ideas, notifications, editor/media-picker data | Session-memory cache / in-flight dedupe | Never public/shared | Explicit mutation invalidation + short TTL safety net |
| `NO_CACHE` | Auth tokens, activation state, security-sensitive responses | None | `private/no-store` | N/A |

## Rules

1. Private/authenticated responses must never be made publicly cacheable to gain performance.
2. Prefer eliminating a request at the client before adding a global DB result cache for user-scoped editor data.
3. Every mutation of cached data must have an explicit invalidation path. TTL is a safety net, not the primary consistency mechanism for first-party writes.
4. For public catalog data, prefer cache tags or narrow path invalidation over broad `revalidatePath` calls.
5. Reference data may use long stale-while-revalidate windows because edits are rare and admin writes can explicitly invalidate it.
6. Do not cache publication-critical validation, authorization decisions, or mutable private state in shared/CDN caches.
7. Before adding a database index for a hot read, confirm the real query shape and inspect `EXPLAIN (ANALYZE, BUFFERS)` on representative data.

## Media picker policy

The media picker is `PRIVATE_SESSION` data.

Current implementation:

- `useMediaLibraryPager` keeps already loaded cursor pages in component memory across dialog close/open cycles.
- Fresh snapshots are reused for 5 minutes instead of clearing the grid and refetching the first page on every open.
- A stale snapshot remains visible while the first page refreshes, avoiding an empty-grid reload flash.
- Successful article uploads explicitly invalidate the owner's picker snapshot so the next open fetches the new media immediately.
- Changing `ownerKey` clears local state, preventing reuse across article authors.
- `useArticleMediaSource` reuses the `Фото этой статьи` snapshot for the same live editor state; changing cover/blocks changes the snapshot key and triggers a fresh read on the next open.

This intentionally does **not** put authenticated media-picker API responses in a public HTTP/CDN cache.

## Existing project examples

- Cities / geo reference endpoints use shared reference-data cache headers.
- `citySlug -> cityId` uses Next server cache with a one-hour revalidation window.
- Weather uses a short public cache with stale-while-revalidate.
- Stories and story intent configuration use Next cache/tag invalidation.
- Publicly servable immutable media can use long browser caching; authenticated-only media must remain private/no-store.

## Next audit order

1. Admin/business shell counters and repeated navigation reads.
2. Public catalog list/detail reads for Events, Places, Offers and Articles: document cache tags and invalidation coverage.
3. User Plan / Ideas repeated fetches: shared client cache and mutation invalidation.
4. Editor reference APIs and taxonomy reads.
5. Hot Prisma query plans and compound indexes, based on production-like `EXPLAIN` evidence.

Do not introduce Redis or another distributed cache until application-level request duplication, Next cache usage, HTTP policy and database indexes are measured and shown to be insufficient.
