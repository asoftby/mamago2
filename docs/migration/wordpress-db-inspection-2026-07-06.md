# WordPress DB Inspection — 2026-07-06

Snapshot of a real, live, read-only `migration:inspect:wordpress-db` run
against the production WordPress MySQL database. This is not a log to
archive and forget — treat it as the reference contract for anyone building
the WordPress adapter/normalizer (Project Phoenix Phase 4). Re-running the
inspect CLI should be the only reason to update this file; nobody should
need to re-derive this structure from scratch.

Source: `pnpm migration:inspect:wordpress-db --allow-remote-readonly`,
via [scripts/migration-inspect-wordpress-db.ts](../../scripts/migration-inspect-wordpress-db.ts).
Read-only; nothing was imported or written. Counts are a point-in-time
snapshot — re-verify before relying on exact numbers for capacity planning,
but the *structure* (tables, columns, meta_key names, taxonomy names) is
stable and safe to build against.

## 1. `migration:inspect` — value delivered today

Before this run, the WordPress adapter design was based on a static TSV/SQL
audit archive (`mamago-wp-audit-20260703-034032.tar.gz`) that had **zero
row-level samples for `post`/`places`** (only `events` rows), plus a
hypothesis that Voxel's `wp_voxel_index_places` might already denormalize
phone/work_hours/category/price/age. Today's live run:

- Confirmed real `post`/`places` data exists and is queryable (the TSV
  archive genuinely could not have answered this).
- Disproved the Voxel-index-as-field-source hypothesis for everything
  except coordinates (see §5).
- Surfaced real `meta_key` usage counts per post_type, not just aggregate
  taxonomy/table names.
- Surfaced Elementor/Web-Story content markers in `post`, changing the
  Article normalizer design (see §4).

This is the intended role of `migration:inspect` going forward: run it
first for any new adapter, before writing a line of discover/normalize
code.

## 2. POSTS — post_type × post_status counts

MVP-relevant rows (see `docs/migration/wordpress-to-mamago.md` for the full
approved mapping table):

| post_type | mamaGo target | status | count |
| --- | --- | --- | --- |
| `post` | Article | publish | **115** |
| `post` | Article | draft | 2 |
| `post` | Article | auto-draft | 1 |
| `post` | Article | trash | 1 |
| `places` | Place | publish | **82** |
| `places` | Place | draft | 11 |
| `places` | Place | unpublished | 187 |
| `hb-programs` | Offer (program) | publish | 90 |
| `hb-programs` | Offer (program) | draft | 2 |
| `routes` | Route | publish | 14 |
| `events` | Activity | publish | 28 |
| `events` | Activity | draft | 538 |
| `events` | Activity | expired | 2864 |
| `profile` | (undecided, see Phase 1 doc) | publish | 536 |
| `attachment` | MediaAsset | inherit | 9635 |
| `attachment` | MediaAsset | private | 15 |
| `page` | Page/Article (undecided) | publish | 71 |
| `page` | Page/Article (undecided) | draft | 13 |

Full custom-post-type long tail (not in MVP scope, listed for completeness):
`accommodation`(2), `ads-tools`(7), `breakingnews`(46), `collection`(90+2 trash+1
unpublished), `discounts`(2), `e-landing-page`(6 draft), `elementor_library`(365),
`groups`(5 draft), `jobs`(5), `market`(1), `marketplace`(1),
`master-classes-fest`(15), `offers`(8), `pesochnica`(1), `pins`(2), `popup`(3+3
draft), `products`(9+5 draft), `scenarios`(1), `services`(1), `specialists`(20
publish+5 pending), `traveling`(3+10 draft), `uslugi`(9), plus assorted
system/plugin post types (`bsf_custom_fonts`, `nav_menu_item`, `oembed_cache`,
`revision`=8243, `wp_font_face`/`wp_font_family`, `wp-story`, etc.) — these are
WordPress/plugin internals or genuinely out-of-scope content types, not
targets for Phoenix.

## 3. USERS / MEDIA / REDIRECTS — top-level counts

- **Users**: 579 (`wp_users`, no role/capability data included in this
  count — that's in `wp_usermeta`, not queried at this level of inspection).
- **Media**: 9635 attachment posts (`inherit` status).
- **Redirects**: 156 rows in `wp_rank_math_redirections`.

## 4. Voxel index tables — confirmed, not hypothesized

### `wp_voxel_index_post`
Columns: `id (int), post_id (bigint), post_status (varchar), priority
(tinyint), _keywords (text)`.

**Conclusion: search index only.** `_keywords` is a single concatenated
free-text blob (title + description + address + categories mixed
together). Not a field source for the Article normalizer — use it at most
as a fallback search/excerpt hint, never as structured input.

### `wp_voxel_index_places`
Columns: `id (int), post_id (bigint), post_status (varchar), priority
(tinyint), _keywords (text), _location (point), _range (smallint),
activity_timeline (datetime)`.

**Conclusion: mostly the same search-index shape, with one exception.**
`_location` is a native MySQL `POINT` type — a genuinely better coordinate
source than parsing the free-text `location` WP postmeta value by hand.
Extract via `ST_X(_location)` / `ST_Y(_location)`. Nothing else in this
table (phone, work hours, category, price, age) is present — those still
come from `wp_postmeta` as originally planned.

## 5. Place field mapping — confirmed source-of-truth table

| mamaGo field | WordPress source | Notes |
| --- | --- | --- |
| title | `wp_posts.post_title` | |
| slug | `wp_posts.post_name` | plus `_wp_old_slug` postmeta for slug history |
| description | `wp_posts.post_content` | |
| shortDesc | `short-desc-place` postmeta | present on 279/282 places rows |
| phone | `phone` postmeta | present on 245/282 |
| email | `email` postmeta | present on 97/282 |
| coordinates | `wp_voxel_index_places._location` | via `ST_X`/`ST_Y`, see §4 |
| city | `city-place` postmeta | present on 250/282 |
| workHours | `work_hours` postmeta | present on 264/282; format still needs a dedicated parser (not inspected at value level here) |
| gallery/cover | `attachment` posts + `_thumbnail_id` postmeta | logo excluded per earlier decision, see `docs/migration/wordpress-to-mamago.md` addendum |
| categories | `wp_term_relationships` → `wp_term_taxonomy` → `wp_terms` | **multi-taxonomy per place**, not single-category — RankMath alone stores primary-term markers across `rank_math_primary_places_category`, `rank_math_primary_age`, `rank_math_primary_pets-allowed`, `rank_math_primary_features-kids-cafe`, `rank_math_primary_features-trampolines`, `rank_math_primary_intersests` (274 rows each) — confirms places carry several independent classification axes simultaneously, not one category field |
| seo | RankMath postmeta (`rank_math_title`, `rank_math_focus_keyword`, `rank_math_seo_score`, `rank_math_analytic_object_id`, `rank_math_contentai_score`) | |
| redirects | `wp_rank_math_redirections` | separate table, not postmeta |
| booking/claim | `booking-place-set`, `claim-listing` postmeta | 140/282 each — not yet mapped to a mamaGo field, flag for product decision |

Top `places` postmeta keys by row count (of 282 total places rows across
all statuses): `_edit_lock`/`_edit_last` (280/279), `rank_math_internal_links_processed`
(279), `short-desc-place` (279), `rank_math_seo_score`/`rank_math_analytic_object_id`
(278), `_wp_page_template` (277), `location` (275), the `rank_math_primary_*`
family (274 each, six different taxonomies), `work_hours` (264),
`rank_math_primary_region` (253), `rank_math_contentai_score` (252),
`rank_math_primary_city`/`rank_math_primary_country` (250), `phone`/`city-place`
(245), `rank_math_focus_keyword` (243), `rank_math_primary_places_social_networks`
(241), `voxel:view_counts`/`voxel:view_chart_cache` (211), `booking-place-set`/`claim-listing`
(140), `email` (97), `voxel:timeline_stats`/`voxel:timeline_reply_stats` (93).

## 6. Article normalizer — confirmed complexity, staged design required

Top `post` postmeta keys (of 118 total `post` rows across statuses) confirm
real structural complexity, not just SEO metadata:

- `rank_math_internal_links_processed`/`_edit_lock` (118), `_edit_last`/`rank_math_analytic_object_id`/`voxel:view_counts`/`voxel:wall_stats`/`voxel:review_stats`/`rank_math_seo_score`
  (117 each), `rank_math_focus_keyword` (111), `_thumbnail_id` (109 — featured
  image present on nearly all posts).
- **Web Stories**: `wp-story-cycle-image`/`wp-story-image` (59 each) — a
  meaningful chunk of posts were authored as WordPress web stories, not
  plain articles.
- **Elementor**: `_elementor_data`/`_elementor_template_type` (19–22),
  `_elementor_edit_mode`/`_elementor_conditions` (19), `_elementor_page_assets`
  (17) — confirms a real subset of posts need Elementor JSON parsing, not
  plain `post_content` HTML, to reconstruct `contentJson` faithfully.
- `_wp_old_slug` (28) — lower than the 513 figure from the earlier TSV
  audit, because that figure was summed across **all** post types; this is
  the `post`-only count.
- Other recurring keys: `rank_math_schema_VideoObject` (58),
  `rank_math_og_content_image` (29), `rank_math_description` (25), `likes`
  (24), `footnotes` (22), `_vp_views_count`/`pgc_sgb_lightbox_settings` (20),
  `image-main-page`/`video-url` (16), `voxel:priority` (11).

**Resulting normalizer shape** (confirms the user's proposed staged
pipeline): raw WP post → content-type detector (plain HTML vs Elementor vs
Web Story) → per-type content extraction → featured image resolution → SEO
field mapping → `NormalizedArticleImport`. A single naive `post_content`
HTML-to-`contentJson` pass would silently mishandle the Elementor and
Web Story subsets.

## 7. Taxonomies — top terms by usage

`places_category` (53 terms), `section` (43), `neighbourhood` (40), `metro`
(39), `events-category` (37), `org-capacity` (37), `uslugi-category` (34),
`route-duration` (32), `city` (31), `room-equipment-travel` (25), `edu-tools`
(19), `age` (19), `theme-party` (18), `services-on-site` (15), plus a long
tail of vertical/plugin-specific taxonomies (`bedroom-1..6`, `film-genre`,
`kids-party`, `district`, etc.) mostly tied to non-MVP post types
(`traveling`, `hb-programs` sub-taxonomies, `services`).

## 8. Open items for the normalizer, not yet resolved by this inspection

- Exact `work_hours` postmeta *value* format (this inspection confirmed the
  key exists on 264/282 places, not its internal structure — needs a
  targeted value sample before writing the parser).
- `booking-place-set` / `claim-listing` postmeta — present on 140/282
  places, no mamaGo field mapped yet; needs a product decision, not a
  normalizer guess (consistent with the "editor resolves ambiguity"
  principle already recorded in `docs/migration/wordpress-to-mamago.md`).
- `profile` (536 rows) and `page` (71+13 rows) post types remain
  unresolved per Phase 1 "Needs Decision" — this inspection did not narrow
  those questions further.

## 9. Proposed next epic — Project Phoenix Phase 4: WordPress Adapter

Sequencing proposed after this inspection (infra — adapter registry, types,
policies, inspect CLI — is considered done; this is the first epic that
touches real WordPress data end-to-end):

1. **WordPress Repository** — `getPosts()`, `getPostMeta()`, `getTerms()`,
   `getAttachments()`, `getUsers()`. SQL only, no discover/normalize logic.
2. **Discover** — `SourceRecordEnvelope` production from the repository,
   no normalize.
3. **Normalizer: Place** — using the §5 field mapping table as the spec.
4. **Normalizer: Article** — using the §6 staged content-type pipeline.
5. **Preview** — `migration:preview`.
6. **Review UI**.
7. **Commit**.
8. **Media**.
9. **Redirects**.
10. **Users**.

This ordering matches the already-established principle (confirmed
repeatedly this session): build the smallest verified layer first
(repository → discover → normalize), don't build planner/repository-write/
commit machinery before there's real normalized output to plan around.

## 10. Routes — live inspection addendum (2026-07-13)

This inspection originally covered only `post`/`places` postmeta (§6/§5).
`scripts/migration-inspect-wordpress-db.ts` was extended with
`top_postmeta_keys_routes`, `sample_route_location_meta`, and
`sample_route_full_postmeta` (a full, unfiltered postmeta dump for the
first 2 published route posts — the most reliable of the three, since it
can't miss a field due to a wrong key-name guess) specifically to answer
one open question before Phase 4 PR A: does a `RouteStop` carry a stable
WP Place post ID? Run live 2026-07-13 against production (14 published
`routes` rows, per §2).

Findings:

- Confirmed keys: `title-location-N`, `description-location-N`,
  `images-location-N`, 1-based, observed up to N=11.
  `images-location-N` is one comma-separated attachment-id string.
- **No place/stop reference key exists anywhere** — confirmed both by the
  aggregated top-60 key list (nothing resembling one, and any systematic
  per-stop field would show a count comparable to `title-location-N`'s,
  which none do below the noise floor) and by the full unfiltered dump for
  2 real routes (85 rows, no exceptions). `RouteStop.placeId` is `null` for
  all imported stops in Phase 4 PR A — a confirmed fact, not a punted
  decision.
- One real route (post 29290) has a bare, unsuffixed
  `title-location`/`description-location`/`images-location` key whose
  value exactly duplicates stop 10's content — stale/duplicate data, not a
  0th/12th stop. The generic `groupIndexedMeta()` helper excludes
  unsuffixed keys for exactly this reason (see
  `src/lib/migration/adapters/wordpress-db/groupIndexedMeta.ts`).
- Route-level `location` postmeta is a single JSON blob
  (`{address, latitude, longitude, map_picker}`) — one per route, not
  per-stop. No per-stop coordinates exist in the source. Product decision
  (2026-07-13): not imported into `Route`/`RouteStop`; preserved only in
  normalized evidence (`locationRaw`, parsed `location` when valid, and
  `rawMeta.location`) with warning `ROUTE_LEVEL_LOCATION_DROPPED`.
- `route-budget`/`route-duration`/`passing-time` are all taxonomies (their
  `rank_math_primary_*` postmeta is just the RankMath "primary term"
  marker, not a value). `rank_math_primary_route-budget` was `0` on both
  sampled real routes — meaning the primary-term marker alone cannot be
  trusted.
- `route-duration`/`reels-route`/**`route-budget`**/route-level `location`:
  product decision (2026-07-13) to never import any of these — see the "Routes" section of
  `docs/migration/wordpress-to-mamago.md` for the reasoning (budget is
  derived later from per-stop prices during manual review instead; a
  static WP-term mapping would only be thrown away once that review sets
  real prices).

See `src/lib/migration/adapters/wordpress-db/normalizeRoute.ts` and
`groupIndexedMeta.ts` (Phase 4 PR A) for where these findings were applied.

### `route-budget` terms — live inspection follow-up (2026-07-13)

Not used by the importer (see decision above), but kept here for whoever
does the manual per-route review — this is what `route-budget` actually
contains. Run via the added `route_budget_terms` inspect-CLI step
(`wp_terms` ⋈ `wp_term_taxonomy` `WHERE taxonomy='route-budget'`).

The 6 terms are themselves price-range labels (not abstract budget tiers),
confirming budget in the source was modeled as a price bracket per route,
matching the target model's "derive budget from stop prices" approach:

| Price range (term name) | Routes using this term |
| --- | ---: |
| до 100 | 5 |
| 100–200 | 1 |
| 200–300 | 2 |
| 300–400 | 0 |
| 400–500 | 0 |
| больше 500 | 5 |

Total usage across all 6 terms: 13. There are 14 published routes, so
exactly one route has no `route-budget` term assigned at all — expected
given the term is never required, not a data error.
