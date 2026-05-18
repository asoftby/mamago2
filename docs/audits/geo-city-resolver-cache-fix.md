# Geo City Resolver Cache Fix

Date: 2026-05-19
Scope: backend cache for `citySlug -> cityId` in geo reference-data routes
Method: code-path update only; no frontend or response-contract changes

## What was happening before

Both routes resolved `citySlug` inline with their own Prisma lookup:

- [src/app/api/geo/districts/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/geo/districts/route.ts)
- [src/app/api/geo/metro-stations/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/geo/metro-stations/route.ts)

When search/filter UI requested both endpoints together, each route separately did:

- `prisma.city.findUnique({ where: { slug }, select: { id: true } })`

That duplicated a small but unnecessary DB lookup on the same request burst.

## What changed

A shared helper was added:

- [src/server/geo/resolveCityIdBySlug.ts](/Users/shapovalovalexey/dev/mamago2/src/server/geo/resolveCityIdBySlug.ts)

Both geo routes now delegate slug resolution to that helper.

Routes migrated:

- [src/app/api/geo/districts/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/geo/districts/route.ts)
- [src/app/api/geo/metro-stations/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/geo/metro-stations/route.ts)

## Cache strategy

Chosen strategy: `unstable_cache` with a per-slug cache key and 1 hour revalidation.

Why:

- `citySlug -> cityId` is stable reference data
- the project already uses `unstable_cache` in server-side reference-data paths
- it avoids rolling a separate module-level TTL cache for a simple read-through lookup
- it safely caches both hits and misses, which helps when both geo routes are called for an unknown slug

## Response compatibility

Response shape did not change.

Unchanged behavior:

- missing `cityId` and `citySlug` still returns `400`
- unknown `citySlug` still returns `{ districts: [] }` or `{ metroStations: [] }`
- existing route `Cache-Control` headers stay intact
- query params remain the same

## Remaining risks

- Cache invalidation is still TTL-based. If an admin edits a city slug, the cached `slug -> id` mapping can remain stale until revalidation.
- This phase caches only the resolver. It does not yet cache the full districts or metro-stations payload on the server side.
