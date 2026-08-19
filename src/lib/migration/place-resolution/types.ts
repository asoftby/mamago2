/**
 * Shared shape for "resolve a source-side reference to an already-imported
 * Place, via `MigrationLineage`, exact match only" — not wired to anything
 * yet. Declared here so it exists once, ready for whichever consumer needs
 * it first.
 *
 * Not used by Route in v1: a full, unfiltered live postmeta dump for real
 * published routes (2026-07-13) confirmed no per-stop WP Place reference
 * exists in the source at all, so there is nothing for this resolver to
 * resolve for Route yet — every `RouteStop.placeId` is simply `null` (see
 * `normalizeRoute.ts`). The next real consumer is `Event.placeIdRaw`
 * (`normalizeEvent.ts`'s `venuePlacePostIdRaw`), which does carry a WP
 * Place post id and currently goes unused downstream — implementing that
 * is its own PR, not part of Route.
 *
 * Lookup contract once wired: build
 * `sourceStableKey = \`${PLACE_ENTITY_TYPE}:${wpPlaceId}\`` (i.e.
 * `wordpress-db:places:<wpPlaceId>`, matching how `toPlaceEnvelope` already
 * keys real imported places), look it up in `MigrationLineage` where
 * `targetType = "PLACE"`, and verify the resulting `Place` still exists
 * before trusting it (case E below).
 */
export type RouteStopPlaceResolution =
  | { kind: "RESOLVED"; placeId: string; sourcePlaceRef: string }
  | { kind: "NO_SOURCE_REFERENCE" }
  | { kind: "UNRESOLVED_LINEAGE_MISS"; sourcePlaceRef: string }
  | { kind: "MALFORMED_REFERENCE"; raw: string }
  | { kind: "LINEAGE_TARGET_INVALID"; sourcePlaceRef: string; targetId: string };

/**
 * - A: valid ref + lineage found + target exists -> `RESOLVED`, no warning.
 * - B: valid ref + lineage missing -> `UNRESOLVED_LINEAGE_MISS`, warning,
 *   import continues with no placeId.
 * - C: no ref at all -> `NO_SOURCE_REFERENCE`, no warning (expected/normal).
 * - D: ref present but unparseable/ambiguous -> `MALFORMED_REFERENCE`,
 *   warning, never guessed.
 * - E: lineage found but target Place is gone or the wrong type ->
 *   `LINEAGE_TARGET_INVALID`, warning flagged for review (a data-drift
 *   signal, distinct severity from B).
 *
 * No case ever fails the caller's import — worst case is a `null` placeId
 * plus a warning.
 */
export interface RouteStopPlaceResolver {
  resolve(sourcePlaceRef: string | null): Promise<RouteStopPlaceResolution>;
}
