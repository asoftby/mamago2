# Route Stop Rewrite Guard Fix

Date: 2026-05-19
Scope: `src/server/services/route.service.ts`
Follows: Phase 6D (`docs/audits/sync-guards-optimization-fix.md`)

## Where the full replacement was

`updateRoute` in `route.service.ts` always ran inside a `prisma.$transaction`:

```typescript
await tx.routeStop.deleteMany({ where: { routeId } });

const updated = await tx.route.update({
  data: {
    ...scalarFields,
    stops: { create: normalizedStops },
  },
});
```

Every PATCH to `/api/routes/[id]` — including saves where nothing changed except the timestamp — caused a `deleteMany` (removes all stops) followed by sequential `create` (recreates all stops). This also destroyed any server-side geo-enrichment fields (`googlePlaceId`, `formattedAddress`, `addressComponents`, `rawGooglePayload`, `detectedCountryCode`, etc.) that are not part of the client payload.

## What fields are compared

`NormalizedStop` fields — the output of `normalizeStops()` — are the only fields sent by the client and written by `create`. The fingerprint covers exactly those:

| Field | Type | Notes |
|---|---|---|
| `order` | `number` | Position in the route |
| `placeId` | `string \| null` | Linked place reference |
| `address` | `string` | Defaults to `""` when not provided |
| `note` | `string` | Defaults to `""` when not provided |
| `photoUrl` | `string \| null` | Stop photo |
| `lat` | `number \| null` | Latitude |
| `lng` | `number \| null` | Longitude |
| `customTitle` | `string \| null` | Override display name |

Fields intentionally excluded from comparison (server-side enrichment only, not in client payload):
- `googlePlaceId`, `formattedAddress`, `addressComponents`, `rawGooglePayload`
- `detectedCountryCode`, `detectedCountryName`, `detectedCityName`, `detectedRegionName`

## Why order-sensitive comparison

`RouteStop` has an `order` column and a `@@index([routeId, order])`. Changing the sequence of stops is a meaningful user action — a route from A→B→C is different from A→C→B. The fingerprint preserves insertion order (existing stops read `orderBy: { order: "asc" }`, incoming stops follow `normalizeStops` output order). If a user reorders stops without changing content, `stopsChanged = true` and replacement runs.

## Implementation

Added `buildRouteStopsFingerprint` in `route.service.ts`:

```typescript
function buildRouteStopsFingerprint(stops: Array<{
  order: number; placeId: string | null; address: string | null | undefined;
  note: string | null | undefined; photoUrl: string | null;
  lat: number | null; lng: number | null; customTitle: string | null;
}>): string {
  return JSON.stringify(
    stops.map((s) => [
      s.order, s.placeId ?? null, s.address ?? "", s.note ?? "",
      s.photoUrl ?? null, s.lat ?? null, s.lng ?? null, s.customTitle ?? null,
    ]),
  );
}
```

Extended the ownership read inside the transaction to include existing stops (no extra round-trip — this is the read that was already required for authorship check):

```typescript
const existing = await tx.route.findUnique({
  where: { id: routeId },
  select: {
    id: true, slug: true, authorId: true,
    stops: {
      orderBy: { order: "asc" },
      select: { order: true, placeId: true, address: true, note: true,
                photoUrl: true, lat: true, lng: true, customTitle: true },
    },
  },
});
```

Conditional stop replacement:

```typescript
const stopsChanged =
  buildRouteStopsFingerprint(normalizedStops) !==
  buildRouteStopsFingerprint(existing.stops);

if (stopsChanged) {
  await tx.routeStop.deleteMany({ where: { routeId } });
}

const updated = await tx.route.update({
  data: stopsChanged
    ? { ...routeScalarUpdate, stops: { create: normalizedStops } }
    : routeScalarUpdate,
  select: { id: true, slug: true },
});
```

## When replacement is skipped

- Incoming stops (after `normalizeStops`) produce an identical fingerprint to stored stops.
- All eight fields for all stops match in value and order.
- Route scalar fields (title, ageTags, budgetLevel, visibility, status, cityId, coverImageUrl) are still updated even when stops are skipped.

## When replacement intentionally still runs

- Any stop's `order`, `placeId`, `address`, `note`, `photoUrl`, `lat`, `lng`, or `customTitle` differs.
- Stops are reordered (order-sensitive: A→B→C ≠ A→C→B).
- A stop is added or removed (length differs → fingerprints differ).
- `normalizeStops` filters out stops with no placeId, address, or lat/lng, so sending an empty stop that gets filtered may reduce the count → replacement runs.

## Fail-safe

If `existing.stops` is unavailable (e.g., `tx.route.findUnique` returns null), the function throws `ROUTE_NOT_FOUND` before reaching the comparison — no silent data loss.

If `normalizedStops` is empty and existing stops are non-empty (user cleared all stops), fingerprints differ → replacement runs → stops deleted. Correct behavior.

## Side benefit: geo enrichment preservation

Previously, every save dropped `googlePlaceId`, `formattedAddress`, `addressComponents`, and geo-detection fields because `deleteMany` removed them and `create` did not restore them. With the guard, unchanged stops are left in place and their enrichment fields survive repeated saves.

## Risks

- `deriveCityIdFromStops` still runs on every PATCH even when stops are unchanged (it's called before the transaction). The derived `cityId` is written back via the scalar update, which should be the same value. A future optimization could read the current `cityId` from `existing` and skip the derivation when stops are unchanged.
- Floating-point precision: `lat`/`lng` are compared via `JSON.stringify` of the number values. If the DB returns a slightly different float than what the client sent (due to Prisma/PostgreSQL float normalization), fingerprints could differ on every save. In practice this is unlikely since Postgres `Float` is IEEE 754 double, same as JavaScript. Watch for reports of spurious stop rewrites on routes with lat/lng.

## What comes next

- Diff-based stop upsert/delete (only write changed stops rather than full replacement) — left for a future phase.
- Skip `deriveCityIdFromStops` when stops fingerprint matches (read `cityId` from existing route instead).
