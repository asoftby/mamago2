# Phoenix Routes release contract

Phoenix Routes uses the schema's global `Route.slug @unique` constraint as
its durable natural identity. The existing draft builder deterministically
requires and preserves the normalized WordPress slug; the selector is not
city-scoped.

The release is create-only and sequential. Exact slug target state plus
active ROUTE lineage yields CREATE, SKIP_UNCHANGED, conflict, or duplicate
failure without UPDATE or row adoption. Route, all nested RouteStops, and
MigrationLineage commit in one Prisma interactive transaction.

Raw input comes only from `routes/capture.json` below
`PHOENIX_RELEASE_ARTIFACT_ROOT`, after full artifact SHA-256 and schema
verification. There is no WordPress fallback.

Route-level `location` stays only in normalized/raw metadata. A non-empty
value emits `ROUTE_LEVEL_LOCATION_DROPPED` at INFO severity; empty/absent
values do not. No Route or RouteStop target field receives it.

RouteStop media mapping remains unchanged, but this release slice uses media
policy NONE: it performs no external download/upload and creates no
MediaAsset. Domain/source identity is independent of that runtime policy.
