# Offer LOCAL-only execution + production manifest — 2026-07-28

## LOCAL execution performed this session

Only one write action was taken, and it's documented in full in `offer-classification-2026-07-28.md`:
the `Offer.cityId` backfill for all 63 existing rows (CAS-guarded, one-off, protected fields verified
byte-identical before/after, immediately reran to confirm 0 further writes). **No CREATE was
performed** — the safe-63 scope already existed, confirmed unchanged from the prior session's closure
(commit `1fca8c8b`). The historical Batch 1–4 execution/rerun (with its own immutable manifest
SHA-256s, `1e43ef43...` plan / `d1718d6f...` rerun) was **not re-run** — it explicitly says not to be
("Safe canonical OFFERS scope завершён и больше не должен запускаться"), and re-running it would
violate this closure's own "don't repeat proven checks" principle.

## Production execution: manifest readiness

**Not ready to freeze a byte-exact production manifest today**, for a structural reason rather than
missing effort: there is no bulk Offer discovery/preview tool in this codebase (see
`offer-classification-2026-07-28.md`) capable of producing the same kind of deterministic,
re-verifiable per-key hash the Place preview tool produces. The historical LOCAL closure's manifest
hashes (`ca2a7347...`, `bf35ecb2...`, `1e43ef43...`, `d1718d6f...`) were computed by the actual batch
commit run itself, against LOCAL — a fresh equivalent for PRODUCTION would need the same commit
tooling pointed at the production source/target pair, generating its own fresh hashes at that time
(source content or WordPress availability could differ by cutover date, so freezing today's LOCAL
hashes as "the" production manifest would be misleading, not rigorous).

**What is ready:**

```text
Exact scope:              63 sourceRecordKeys (wordpress-db:hb-programs:*, wordpress-db:services:*),
                           identical to the already-closed LOCAL safe-canonical set — no new
                           discovery, no CREATE expected in production either (all 63 targets
                           already exist as MigrationLineage-linked local rows; production execution
                           for this entity is a distinct target DB, so its own CREATE-vs-UPDATE
                           determination happens fresh against the production DB's current state,
                           the same as every other entity's production cutover).
Prerequisite fix:          OfferCommitWriter.ts cityId fix (this session) MUST be in the deployed
                           build before any production Offer commit runs, or production would repeat
                           the exact same cityId-loss bug found and fixed here today.
Media policy:              NONE or METADATA only (FULL is hard-blocked in code for Offer regardless
                           of environment, pending the founder media decision above).
Excluded, by design:       class H (28), class I (8) — not part of any production execution.
Resume point:              per-record, same CAS/lineage-guarded semantics as every other entity —
                           OfferCommitOrchestrator already requires exact lineage + hash match, no
                           new resume logic needed.
Failure policy:            stop-on-first-error, no auto-rollback of an already-committed prefix
                           (existing project-wide rule, nothing entity-specific needed for Offer).
Reconciliation:            re-run the same commit invocation; SKIP_UNCHANGED for anything already
                           correctly committed, by the same lineage/hash mechanism already proven
                           locally.
Idempotency expectation:   SKIP_UNCHANGED / NOOP for all 63 on any rerun once first committed to
                           production — proven at LOCAL scale already (63/63 SKIP_UNCHANGED,
                           2026-07-22), same code path.
```

**Recommendation**: at actual cutover time, run the existing commit tooling once against production
in preview/dry mode first (same pattern as Place), capture *that* run's own manifest hash as the
real production manifest, rather than trying to pre-compute one now from LOCAL data that may have
drifted by then.
