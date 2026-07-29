# P0 Route map guard — 2026-07-29

Status: `RESOLVED LOCAL`; coordinate backfill was not performed.

Branch/base/worktree: `fix/prelaunch-p0-route-search`, `edf8af6b`,
`/Users/shapovalovalexey/dev/mamago2-prelaunch-p0-route-search`.
Changed files: `RouteDetailClient.tsx`, `validRoutePoints.ts` and its test.

The public Route page now counts only distinct, stored, finite in-range
latitude/longitude pairs, excluding incomplete pairs, duplicates and `(0,0)`.
Below two points it does not mount `RouteMapHero` or a polyline and shows the
neutral text `Карта маршрута пока недоступна`.

Tests cover 0, 1, 2 distinct points, invalid ranges, NaN, partial pairs,
duplicates and the technical default. Read-only DB proof reconfirmed the
representative current Routes have zero stored coordinate pairs.

Runtime provenance matches
`p0-route-canonical-fix-2026-07-29.md`. Desktop: empty state present, zero
canvas elements, main H1/content present, zero browser console errors. Mobile
390x844: empty state visible, no horizontal overflow, one canonical. The two
warnings captured during the mobile run were the existing development-only
`ReloadProbe` beforeunload trace caused by the intentional reload, not
hydration/application errors.

Writes: DB lifecycle 0; content 0; search 0; canonical DB 0; media/storage 0.

Unrelated runtime findings: ratings GET 400 is `OPEN P1`; missing local
branding favicon is `OPEN P2`. Main Route content and empty state remain
available.

`BROWSER_PROOF_REVALIDATION_REQUIRED_ON_INTEGRATED_RC`
