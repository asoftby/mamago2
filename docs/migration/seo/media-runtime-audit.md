# Media runtime + internal links audit

## Media runtime

`MEDIA_STORAGE_ROOT` (`src/server/media/media-storage.ts`) is hardcoded to
`join(process.cwd(), "storage")` — no `STORAGE_ROOT` env override exists in
this codebase. Per-file symlinks (not a directory-level symlink, to avoid
disturbing the git-tracked `storage/uploads/.gitkeep`) were created from this
worktree's `storage/uploads/` to the main worktree's real local uploads:

```
source:      /Users/shapovalovalexey/dev/mamago2/storage/uploads (483 files incl. .gitkeep)
destination: storage/uploads/ in this worktree (482 symlinks, .gitkeep untouched)
```

Verified: symlinked file readable (real WebP image data, correct byte
count), source worktree `git status` remains clean (0 writes), destination
`git status` remains clean (`storage/uploads/*` is gitignored except
`.gitkeep`, so the symlinks themselves are invisible to git).

**This closes `MEDIA_RUNTIME_PROOF_BLOCKED` for local dev/prod-build
crawling** — no media/storage writes occurred, source untouched, read-only
mount confirmed working.

### Favicon P2 — likely resolved, confirmed root cause

`MISSING_FAVICON_ASSET` (`/favicon.ico` 307-redirects, target 404s) was
investigated: the branding config's configured favicon
(`1783033874844-9q4z9h5fueo-favicomamago.webp`) has a real, `ACTIVE`
`MediaAsset` row in the DB (uploaded via `ADMIN_UPLOAD`, 512×512 WebP) — the
official asset already exists, it was never missing. The 404 was purely
because the sibling RC worktree's `storage/uploads` was empty (documented
root cause in the original findings). With the media-runtime symlink above,
the physical file is now present. Not marked fully resolved here — will be
confirmed with a live HTTP request during the dev crawl (favicon needs no
code change, only the media mount this session already fixed).

## Internal links

- No hardcoded `mamago.local`/`localhost` links found in any public-facing
  component (`src/app/(public)/**`, `src/components/**`) — the one hit
  (`src/app/(ui)/ui-lab/_sections/OfferPageSection.tsx`) is dev-tooling, not
  a production route.
- Entity card link builders (`PlaceCard`, `Article*CardBlock`) all resolve
  hrefs from live DB slugs via the same canonical path builders audited in
  the canonical-metadata fix (`buildCityPublicPath`, `getOfferPublicPath`,
  `publicActivityPath`) — not hardcoded or cached, so no stale-slug/
  redirect-source risk by construction.
- **One dead/legacy internal link found**: `src/components/place/premium/PlaceHero.tsx`
  links to `href="/places"`, but no `src/app/(public)/places/page.tsx`
  exists — there is no dedicated "all places" listing page. The legacy WP
  redirect manifest happens to remap `/places → /minsk` (see
  `redirect-audit-summary.md`, classified `VALID_HUB_REMAP`), so a real
  visitor clicking this link lands on the Minsk hub instead of a 404 — not
  broken, but not the intended destination either. Not fixed this session
  (no clear correct target without a product decision: build a real
  listing page, or repoint the link to `/{city}` or a discovery page).
  **P1 backlog.**

Full server-rendered internal-link crawl (does every rendered anchor
actually resolve to its own canonical, not a redirect/404) happens in the
dev crawl pass.
