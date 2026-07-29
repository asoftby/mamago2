# Offer media — capability gap assessment — 2026-07-28

## Current state: not implemented, deliberately blocked (confirmed, not a bug)

- `Offer.coverImage` (`String?`) and `Offer.galleryImages` (`Json?`) exist on the schema, but there
  is no `OfferImage` relational table (unlike `PlaceImage` for Place) — a real media importer would
  need a storage/dedup design decision here first, not just a wiring fix.
- `OfferMediaSyncer.ts` is a 19-line policy boundary only: if `mediaPolicy === "FULL"` it requires an
  external `fullDelegate` and throws if none is supplied; `scripts/migration-commit-wordpress-db.ts`
  constructs it with **no delegate at all**, and separately hard-blocks the combination explicitly:
  `if (entity === "offer" && mediaPolicyName === "FULL") throw new Error("Offer FULL media commit
  requires a separate media execution gate; use METADATA or NONE for the initial golden.")`
  (`scripts/migration-commit-wordpress-db.ts:261`). This is an intentional, pre-existing gate, not an
  oversight — confirmed by reading the code directly, not inferred from docs.
- Live DB confirms the result: **0 of 63 Offers have any cover or gallery image.**

## Not a P0 launch blocker (recommendation, not a decision)

None of the 63 safe-canonical Offers are published yet (all `DRAFT` — see
`offer-classification-2026-07-28.md`), and per this closure's own product-policy framing, an Offer
without an image is not itself an invalid state — Offers commonly inherit their parent Place's
visual identity in the UI. Building a real Offer media importer now would mean: designing a storage
model (`OfferImage` table or a `MediaAsset`-linked join, mirroring `PlaceImage`), writing a dedup-aware
download delegate (mirroring `PlaceMediaSyncer`), and wiring it through the same
`mediaPolicy`/`resolveSampledMediaPolicy` gates Place already uses — a genuinely new, scoped piece of
architecture, not something this closure task should build unilaterally ("не строить новый большой
framework").

## Founder decision needed (flagging, not deciding)

```text
Option A: implement a minimal P0 Offer media slice (cover image only, reusing PlaceMediaSyncer's
          dedup/storage pattern) before any Offer goes to production.
Option B: explicitly defer Offer media to P1, matching the same posture as
          ARTICLE MEDIA: PASS_WITH_DOCUMENTED_SOURCE_MEDIA_GAPS from the Articles line.
```

Recommendation if asked: Option B — the existing safe-63 scope is entirely unpublished DRAFT content
today, media is not what's blocking their path to production (the DRAFT-status/publish-process gap
documented in `offer-classification-2026-07-28.md` is), and Place already demonstrates the harder
media-import mechanics work end-to-end for the entities that need them at launch.

## Environment policy (documented, not exercised — nothing to run)

Same `resolveSampledMediaPolicy` mechanism as Place: LOCAL/DEV would only ever run FULL for 3
hand-picked Offer sample keys (`hb-programs:15941`, `:16403`, `:16458`) *if* a delegate existed — it
doesn't, so this is moot today. PRODUCTION profile unconditionally resolves `FULL` once a delegate is
built; nothing in the sampling code needs to change for that, same as Place.
