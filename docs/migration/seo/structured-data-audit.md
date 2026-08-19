# Structured data (JSON-LD) audit

Reviewed all builders in `src/lib/seo/schema/`: Article, Event, Place, Route,
Offer, Organization, WebSite, Breadcrumb, FAQ.

## Real defect found and fixed

**Article JSON-LD `canonicalUrl` bypassed the stored-canonical validator.**
`generateMetadata()` on all three Article render paths (national MVP,
national legacy, city-scoped) was fixed earlier in this phase to reject a
stale/invalid stored `seoCanonicalUrl` via `resolveArticleCanonicalUrl()`.
The *default component* on those same three paths independently recomputed
`canonicalUrl` for `buildArticleJsonLd()` as
`seo.seoCanonicalUrl?.trim() || fallback` — trusting the raw stored value
with no validation. A stale `mamago.local:3000` (or wrong-slug/wrong-city)
stored value would therefore have been correctly rejected in the `<head>`
`<link rel="canonical">`, but still leaked verbatim into the page's own
JSON-LD `url` field — a real `JSON-LD URL ≠ canonical` + localhost-leakage
violation. Fixed all three call sites
(`src/app/(public)/blog/[slug]/page.tsx` ×2,
`src/app/(public)/[city]/blog/[slug]/page.tsx` ×1) to use
`resolveArticleCanonicalUrl()`, matching `generateMetadata()`.

The one remaining raw `seoCanonicalUrl?.trim() ||` occurrence
(`src/app/(public)/offers/[slug]/page.tsx:96`) is inert: that page's default
component unconditionally `permanentRedirect()`s before any HTML is ever
sent, so its `generateMetadata()` output (including this line) never reaches
a real client — confirmed during the canonical P0 fix earlier in this phase.

## Checked, no defect

- **Route / Place / Offer(city) JSON-LD `url`**: each independently
  recomputes the deterministic slug/city-scoped path rather than reading the
  page's resolved canonical variable — architecturally duplicated, but
  `validateStoredCanonical()` only ever accepts a stored value that exactly
  equals that same deterministic path (or falls back to it), so the two
  computations are guaranteed identical in practice. Not touched — no
  observed or reachable divergence, and combining them isn't required to
  fix a real bug (`не перестраивать`, `исправлять только реальные
  нарушения`).
- **No fake ratings**: `buildPlaceJsonLd`'s `aggregateRating` only emits
  when `rating` is a finite number and `reviewCount > 0`; both are sourced
  from real DB fields at the call site, not fabricated.
- **No localhost leakage in defaults**: `buildOrganizationJsonLd` /
  `buildWebSiteJsonLd` / `url.ts`'s `absolutePublicUrl` all default through
  `getCanonicalPublicAppUrl()`, never a hardcoded local origin.
- **Organization/WebSite not duplicated**: emitted exactly once, in the
  shared `src/app/(public)/layout.tsx`, not per-page.
- **`buildOfferJsonLd` wrapper** (distinct from `buildOfferStructuredData`,
  which the live city Offer page actually calls) is dead code for JSON-LD
  purposes — only its `resolveOfferStructuredDataType` helper is imported
  elsewhere. No live-page risk.

## Not deeply re-verified this pass (no evidence of defect, out of scope)

`@type` choices (e.g. Place uses schema.org `Place`, not the more specific
`LocalBusiness`), city/address field-level consistency per entity, and FAQ/
Breadcrumb item-level correctness — these will get an additional pass
during the dev crawl's JSON-LD validity check.
