# ARTICLES Slice 19 proof

Base: `dev @ 0603e54ca8afdcd0b92623ac01a30e4db03a1eac` (PR #90 merge).

Exactly one vetted, exact-key, read-only WordPress fetch returned the published
record `wordpress-db:post:57731`. Query path:
`fetchPublishedArticleEnvelopeBySourceRecordKey`; query/domain version:
`wordpress-db-domain-v2`; canonical envelope hash:
`wordpress-db-domain-v2:658a1ac7be5aa46461f3901e6b31268110ac54ab1f2d512404aef1d65390ef1b`.
No other source records were fetched and WordPress writes were zero.

The existing Article commit vertical produced `LINKED / CREATE`: Article
`25→26`, ARTICLE lineage `911→912`, MigrationRecord `1577→1578`.
MediaAsset stayed `125`; media importer calls and storage writes were zero.
The resulting Article is `PENDING`, with `cityId`, `geoScope`,
`coverImageId`, and `authorUserId` all `null`.

One common sequential rerun covered `post:56250` and `post:57731` without
additional source reads. Both returned `SKIPPED`; both Article rows were
byte-identical and `updatedAt` did not move. There are exactly two active
ARTICLE lineages and no duplicates. The two new MigrationRecord rows are the
existing per-invocation bookkeeping contract.

Read-only reconciliation reused the Slice 17 classifier/repository path:

- `post:56250`: `EXACT_AUTHORSHIP_CANDIDATE`
- `post:57731`: `EXACT_AUTHORSHIP_CANDIDATE`

Authorship writes were zero. Before and after reconciliation the DB was
byte-identical. User role/status, Business/Place ownership, the complete
`post:56250` Article row, Article author relations, and MediaAsset hashes
were unchanged. All forbidden tables were unchanged.

Decision: `AUTHORSHIP_GOLDEN_READY`.

Next exact step: a separately authorized small authorship write slice for
`wordpress-db:user:575`, sequentially assigning both Article
`authorUserId` values, followed by a common `SKIP_UNCHANGED` rerun.
