# ARTICLES Slice 20 proof

Base: `dev @ b50c22fcb9c804c30e50718d4ab72716b55f00b1`
(PR #91 merge).

The fixed scope contained only `wordpress-db:post:56250` and
`wordpress-db:post:57731`, both linked to the active target User for
`wordpress-db:user:575`.

Each Article was processed sequentially in its own transaction. Before each
write the runner rechecked the active User lineage and target User, the exact
single active Article lineage and target Article, the absence of another
active lineage, and `authorUserId=null`. The write used
`Article.updateMany` guarded by the exact Article ID and
`authorUserId IS NULL`; a count other than one aborts the batch.

First run:

- `post:56250`: `ASSIGNED`
- `post:57731`: `ASSIGNED`

One common rerun returned `ALREADY_SATISFIED` for both and issued no Article
updates.

Exactly two Article rows changed, adding two `authorUserId` relations.
Article creates, MigrationLineage, MigrationRecord, Users, Sessions, tokens,
Business/Place ownership, Offers, Routes, Activities, MediaAsset, and storage
writes were all zero. Both Articles remain `PENDING`, with `cityId`,
`geoScope`, and `coverImageId` still `null`.

Decision: `AUTHORSHIP_USER575_COMPLETE`.

Next exact step is a separate editorial closure for the two Articles: city
and geo scope, approved publication flow, blog visibility, and a separate
cover/media decision.
