# Project Phoenix: WordPress to mamaGo 2.0 Migration

Phase 1: Discovery and GAP Analysis

> **Current FULL PROD behavior (2026-08-14), not Phase 1 policy:** Event
> images ARE imported under `--media-policy FULL`. Users, Offers, Routes,
> and Reviews have commit runners. Articles FULL scope is all valid
> published posts, not the old 2-article golden. This document remains
> historical Phase 1 discovery; do not treat “Event images are not
> migrated” below as current importer policy.

This document is read-only analysis only. It does not define an importer implementation, database migration, Prisma schema change, or data mutation plan for the current phase.

## Project Goals

The Migration Engine is a permanent mamaGo module, not a one-off WordPress script. WordPress is the first adapter. Future adapters must be able to support Google Places, CSV, Excel, Partner APIs, and other source systems.

The goal is not to migrate WordPress. The goal is to migrate business data into the native mamaGo 2.0 architecture so that WordPress can be fully retired after migration.

Approved high-level mappings:

| WordPress | mamaGo 2.0 |
| --- | --- |
| `post` | `Article` |
| `places` | `Place` |
| `events` | `Activity` as Event |
| `routes` | `Route` |
| `services` | `Offer` |
| `hb-programs` | `Offer` |
| `wp_users` | `User` |
| `profile` | User profile / Business profile area |
| `wp_voxel_timeline` feed `post_reviews` | `PlaceReview` / Review domain |
| `wp_voxel_relations` | Native entity links |

Final post-Phase 1 decisions:

- `services -> Offer` and `hb-programs -> Offer` are final transformations.
- All users are migrated.
- WordPress passwords are not migrated. After first authorization, imported users pass account reactivation.
- Image migration is limited to User Profile, Business Profile, Place, Article, Offer (Services), Offer (Programs), and Route.
- Event images are not migrated, even for active events.
- Past events are not part of Phoenix v1.
- Every imported entity must be safely re-importable without creating duplicates. Idempotency is mandatory.
- Prisma schema must not be changed during design. If a Prisma change is required, prepare a proposal only.

## Evidence Base

Sources reviewed:

- `prisma/schema.prisma` in the current working tree.
- WordPress audit archive `mamago-wp-audit-20260703-034032.tar.gz`.
- Audit files: `core/schema.sql`, `core/post_types.tsv`, `core/postmeta_keys.tsv`, `core/taxonomies.tsv`, `core/users.tsv`, `core/content_sample.tsv`, `samples/important_postmeta.tsv`, `voxel/relations_stats.tsv`, `voxel/relations_sample.tsv`, `voxel/timeline_stats.tsv`, `voxel/timeline_sample.tsv`, `seo/rankmath_redirects.tsv`, `seo/rankmath_objects_sample.tsv`.
- Existing migration/import/SEO/media code paths under `src/server/modules/import`, `src/lib/seo`, `scripts/build-migration-manifest.ts`, `scripts/data/wp-redirect-map.json`, and media services.

Important audit limitations:

- `seo/rankmath_objects_sample.tsv` is empty.
- `content_sample.tsv` contains only a sample and does not include sample rows for `profile`, `places`, `hb-programs`, `services`, or `routes`.
- The archive includes `wp_usermeta`, `wp_comments`, booking, LatePoint, Voxel, WooCommerce, and SEO table schemas, but not complete data exports for all of those tables.
- Therefore, some conclusions are "schema-ready" or "requires decision", not final field-level mapping.

## Current Architecture

### WordPress

The WordPress source is centered on canonical WP tables plus plugin-specific layers:

- `wp_posts`: content shell for articles, events, places, routes, profiles, attachments, pages, revisions, and custom post types.
- `wp_postmeta`: very large metadata layer. The audit shows `AUTO_INCREMENT=1003156` and important keys for events, locations, galleries, SEO, profiles, children, legal data, offers, routes, and Voxel counters.
- `wp_users` and `wp_usermeta`: account identity and user metadata. `users.tsv` contains 579 users.
- `wp_terms`, `wp_term_taxonomy`, `wp_term_relationships`: taxonomies such as `places_category`, `events-category`, `metro`, `neighbourhood`, `age`, `program-age`, `route-budget`, `route-duration`, `services-categories`, and many vertical-specific taxonomies.
- `wp_voxel_relations`: generic parent-child post relationships with `relation_key`.
- `wp_voxel_timeline`: Voxel social/review feed with feed types `post_reviews`, `post_wall`, `post_timeline`, `user_timeline`.
- `wp_rank_math_redirections`: serialized RankMath redirect rules.
- `wp_comments`, `wp_commentmeta`: small core comment schema is present, but no comment data export is included.
- `wp_booking`, `wp_bookingdates`, `wp_latepoint_*`: booking-related schemas are present.

Content counts from `post_types.tsv`:

| Post type | Statuses / counts |
| --- | --- |
| `post` | `publish=115`, `draft=2`, `auto-draft=2`, `trash=1` |
| `places` | `publish=82`, `draft=11`, `unpublished=187` |
| `events` | `publish=35`, `draft=538`, `expired=2857`, `auto-draft=2` |
| `hb-programs` | `publish=90`, `draft=2` |
| `services` | `publish=1` |
| `routes` | `publish=14` |
| `profile` | `publish=536` |
| `attachment` | `inherit=9620`, `private=15` |
| `page` | `publish=71`, `draft=13` |
| Other notable custom types | `collection=93`, `specialists=25`, `products=14`, `traveling=13`, `uslugi=9`, `offers=8`, `master-classes-fest=15`, many system/plugin types |

Important postmeta keys include:

- Media: `_wp_attachment_metadata`, `_wp_attached_file`, `_thumbnail_id`, `gallery`, `logo`, `cover`, `_wp_attachment_image_alt`.
- SEO: `rank_math_title`, `rank_math_description`, `rank_math_canonical_url`, `rank_math_robots`, `rank_math_focus_keyword`, `rank_math_og_content_image`, `_wp_old_slug`.
- Places: `location`, `phone`, `website`, `work_hours`, `short-desc-place`, `city-place`, `email`, `unp`, `company-name`, `legal-title`, `legal-address`.
- Events: `event_date`, `event-place-name`, `event_city`, `event-cost`, `url-buy-ticket`, `external_event_id`, `external_last_updated`, `trailer-url`, seasonal switchers.
- Offers/programs: `program-cost`, `average-check-program`, `hb-program-duration`, `max-guests-program`, `program-age`, `services-for-kids`.
- Routes: `title-location-*`, `description-location-*`, `images-location-*`, `route-budget`, `route-duration`, `description-route`, `reels-route`.
- Profiles/children: `gender-1-kid`, `kid-1-name`, `date-of-birth-1-kid`, repeated child fields, user phone fields.

Voxel relation counts show generic links that need typed mapping:

| Relation key | Count |
| --- | ---: |
| `items` | 648 |
| `post-relation-places-events` | 94 |
| `post-relation-hb-programs` | 74 |
| `place-relation` | 70 |
| `post-relation-hb-program` | 43 |
| `reviews-on-this-place` | 40 |
| `other-objects-on-the-territory` | 28 |
| `post-relation-specialists` | 26 |
| `post-relation` | 20 |
| Many low-count relation keys | 1-17 each |

Voxel timeline stats:

| Feed | Moderation | Count |
| --- | ---: | ---: |
| `post_reviews` | 1 | 25 |
| `post_wall` | 1 | 40 |
| `post_timeline` | 1 | 8 |
| `user_timeline` | 1 | 24 |

RankMath redirects:

- 156 rows in `rankmath_redirects.tsv` including active, trashed, and inactive rows.
- Source rules are PHP-serialized objects and include comparison modes such as `exact`, `start`, and `contains`.
- Some destinations are canonical content URLs, while many redirect to `/` or section hubs.

### mamaGo

The mamaGo schema is strongly normalized around native product entities:

- Users and profiles: `User`, `Child`, `ChildInterest`, `ChildCustomInterest`, `UserBehaviorProfile`.
- Business layer: `Business`, `BusinessMember`, `BusinessInvite`, `BusinessVerificationLog`, `BusinessAccessRequest`, `Organizer`.
- Geography: `Country`, `Region`, `City`, `District`, `MetroStation`.
- Events: `Activity`, `EventVenue`, `ActivitySession`, `ActivityImage`, `ActivitySlugHistory`, `ActivityFilterOption`, `ActivityProgramCategory`, `ActivityOccasion`.
- Places: `Place`, `PlaceImage`, `PlaceRevision`, `PlaceRevisionImage`, `PlaceReview`, `PlaceSlugHistory`, `PlaceGroup`, `PlaceSubcategory`, `OpeningHours`.
- Offers: `Offer`, `OfferSession`, `OfferSlugHistory`, `PackageComponent`, `OfferPlacement`.
- Articles: `Article`, `ArticleSlugHistory`, `Page`.
- Routes: `Route`, `RouteStop`, `RouteSlugHistory`, `RouteRating`.
- Media: `MediaAsset`, `MediaUsage`, `TempMedia`.
- SEO fields are embedded on content models: `seoTitle`, `seoDescription`, `seoH1`, `seoCanonicalUrl`, `seoOgTitle`, `seoOgDescription`, `seoOgImage`, `seoRobots`, `seoJsonLdOverride`, `seoCanonicalSource`.
- Discovery/taxonomy: `SignalDefinition`, `SignalOption`, `FilterDefinition`, `FilterOption`, `DiscoveryTaxonomyEntry`, `DiscoveryClassChip`, `DiscoveryTag`, `EventCategory`, `Genre`, `Occasion`.
- Existing import pipeline: `ImportSource`, `ImportRun`, `ImportedRecord`, `ImportReviewTask`, `ImportFieldOverride`.
- Existing redirect machinery: build-time `manifest.csv` via `scripts/build-migration-manifest.ts`, `src/lib/seo/redirectManifest.ts`, `scripts/data/wp-redirect-map.json`, and a WP legacy catch-all classifier.

Key current constraints:

- The existing import pipeline is a useful foundation, but it is not yet the full permanent Migration Engine. It is currently optimized for web-source place/event/offer imports.
- `ImportEntityType` currently supports only `PLACE`, `EVENT`, `OFFER`.
- `ImportedRecord` links only to `publishedPlaceId` and `publishedActivityId`; there is no published offer/article/route/user/media/review/redirect link.
- There is no dedicated database model for legacy WP IDs or generic migration lineage.
- There is no dedicated database model for RankMath redirect rules; redirects are currently file/build-time oriented.
- There is no separate `Profile` model in Prisma. User profile data lives on `User` and `Child`; business profile data is split across `Business`, `BusinessMember`, `Place`, `Offer`, and `Organizer`.
- These constraints are candidates for design proposals only. This document does not change Prisma.

## GAP Analysis

| WordPress Entity | mamaGo Entity | Status | Comment |
| --- | --- | --- | --- |
| `wp_users` | `User` | Requires transformation | Basic identity maps well: email, display name, registration time. Passwords must not migrate. Need activation flow and legacy user ID mapping. |
| `wp_usermeta` | `User`, `Child`, preferences | Partial / missing data export | Schema exists in WP audit, but no usermeta sample export. Child-related postmeta exists, but exact user ownership mapping must be confirmed. |
| `profile` post type | User profile / Business profile | Missing direct model | 536 published profiles. mamaGo has no `Profile` model. Need classify personal vs business profiles and map to `User`, `Child`, `Business`, `Organizer`, media, and possibly pages. |
| `places` | `Place` | Mostly ready with transformation | Strong target model with city, geo, address, phone, website, hours, SEO, slug history, images, reviews. Needs taxonomy/category mapping, legacy ID mapping, owner assignment, opening-hours conversion. |
| place images | `PlaceImage`, `MediaAsset`, `MediaUsage` | Partial | Model exists, but WP attachment IDs need a stable legacy media map. |
| place working hours | `OpeningHours` | Ready with transformation | WP `work_hours` JSON can map to weekly rules, but statuses such as `open`, `hours`, `closed`, `appointments_only` need deterministic conversion. |
| `events` | `Activity` | Mostly ready with transformation | `Activity` supports schedule, venue, pricing, age, SEO, category, organizer, discovery signals. Phoenix v1 excludes past events and excludes event images. Need active/future eligibility and complex `event_date` transformation. |
| event venue metadata | `EventVenue`, `Place`, `Organizer` | Partial | WP has `event-place-name`, `location`, `adress-event-place`, `website`, `phone`. Need decision when to link to existing `Place` vs keep manual venue. |
| `services` | `Offer` | Mostly ready with transformation | `Offer` has service/package/camp fields, contact fields, SEO, gallery JSON, bookings. Need exact service taxonomy mapping. |
| `hb-programs` | `Offer` | Mostly ready with transformation | 90 published programs. Offer has many camp fields but import requires mapping program cost, duration, age, capacity, schedule, location and parent place. |
| `routes` | `Route`, `RouteStop` | Partial | Route and RouteStop exist. WP route stop fields are repeated postmeta keys, not normalized. Need parser for `title-location-*`, `description-location-*`, `images-location-*`, budget/duration. |
| `post` | `Article` | Mostly ready with transformation | Article has slug, content JSON, SEO, media, author, category, tags, city scope. Need HTML/Elementor/blocks to `contentJson` conversion strategy. |
| `page` | `Page` | Needs decision | WP has 71 published pages. mamaGo has `Page`, but migration scope only approved `post -> Article`; decide which WP pages are legal/static/editorial content worth preserving. |
| `attachment` | `MediaAsset` | Partial | Media model is strong and has `MediaSourceType.MIGRATED`, but there is no legacy attachment ID field or migration media ledger. Only approved scoped images should migrate; event images are explicitly excluded. |
| `_thumbnail_id`, `gallery`, `logo` | Content image relations | Requires transformation | Requires resolving WP attachment IDs before content import can attach covers/galleries/logos safely. |
| RankMath SEO postmeta | Native SEO fields | Partial | Standard title/description/canonical/robots/OG fields exist on content models. RankMath focus keyword, scores, analytic object IDs, and internal-link flags have no target unless intentionally ignored. |
| `_wp_old_slug` | Slug history models | Mostly ready | `ActivitySlugHistory`, `PlaceSlugHistory`, `OfferSlugHistory`, `ArticleSlugHistory`, `RouteSlugHistory` exist. Need legacy URL section mapping and city-scoped uniqueness checks. |
| `wp_rank_math_redirections` | `manifest.csv` / Next redirects | Partial / architecture gap | Current redirects are generated from DB article slug history and curated JSON map. RankMath serialized redirects are not a first-class source. |
| `wp_voxel_timeline.post_reviews` | `PlaceReview` | Requires transformation | Review table exists for places, but WP score is decimal from `-2.00` to `2.00`, not 1-5 integer. Likes/replies/raw author links are not represented in `PlaceReview`. |
| `wp_voxel_timeline.post_wall`, `post_timeline`, `user_timeline` | No direct model | Needs decision | These are social feed/wall entries, not covered by approved mapping except reviews. Decide whether to ignore, archive, or build a native timeline model later. |
| `wp_voxel_relations` | Native typed relations | Partial | Some keys can map to `Activity.placeId`, `Offer.placeId`, `Article.relatedPlaceId`, `RouteStop`, `PackageComponent`; many keys have no direct target. |
| WP taxonomies | `EventCategory`, `Genre`, `SignalDefinition`, `FilterDefinition`, `DiscoveryTag`, `District`, `MetroStation`, `City`, `Occasion` | Requires transformation | Target primitives exist, but no legacy term mapping table exists. Need curated taxonomy mapping before import. |
| Voxel index tables | Discovery/search fields | Requires transformation | Useful as source for priority, keywords, seasonal flags, geo, and discovery signals. They are not canonical content. |
| `wp_comments` | No direct general comment model | Needs decision | `PlaceReview` can cover reviews; no generic comments model. Audit has schema but no comments data export. |
| `wp_booking`, `wp_latepoint_*` | `BookingRequest`, `BookingActivity`, `OfferSession`, `ActivitySession` | Needs decision | Booking schemas exist in WP and mamaGo, but not in approved migration scope. Decide whether historical bookings matter. |
| WooCommerce/order tables | Billing/commerce models | Out of approved scope | WP has WooCommerce/Voxel order tables; mamaGo has billing/commercial models, but no approved mapping. |
| `collection`, `products`, `traveling`, `specialists`, `uslugi`, `master-classes-fest`, etc. | Mixed / no direct target | Needs decision | Some may map to Article, Place, Offer, Route, or be ignored. Need business triage. |

## Users

Ready:

- `User` has email, password hash, role, status, display name, avatar URL, phone, verification timestamps, marketing email preference, child relations, behavior profile, and business ownership.
- `Child` can store child name, birth date, interests, system interests, and custom interests.

Requires transformation:

- All WordPress users are in scope for migration.
- `wp_users.ID` should become a legacy identifier in the migration ledger, not mamaGo `User.id`.
- `user_email` maps to `User.email`.
- `display_name` maps to `User.displayName`.
- `user_registered` maps conceptually to `User.createdAt`, but preserving exact timestamps requires import logic that can set created timestamps.
- WordPress roles/capabilities are likely in `wp_usermeta`, but that data is not exported in the audit.
- Passwords are intentionally not migrated; imported users must go through account reactivation after first authorization.

Potential field loss:

- `user_login`, `user_nicename`, `user_url`, `user_activation_key`, `user_status`.
- WordPress role/capability metadata if `wp_usermeta` is not exported.
- Legacy phone/login plugin data from `wp_digits_*` tables unless explicitly included.

Required before Phase 2:

- Define import identity policy: match by email only, or create all users with legacy ID ledger and conflict handling.
- Define default role/status for migrated users.
- Define activation email/product flow for the approved reactivation requirement.

## Profiles

WordPress has 536 published `profile` posts, while mamaGo has no standalone `Profile` Prisma model.

Existing target pieces:

- Personal profile: `User`, `Child`, user preferences/signals, `avatarUrl`.
- Business profile: `Business`, `BusinessMember`, `Organizer`, owned `Place`, owned `Offer`.
- Media: `MediaAsset`, `MediaUsage` with entity types `USER` and `BUSINESS`.

Gaps:

- No native profile slug/history model.
- No direct model for public profile page content, profile post body, profile cover/logo history, or profile-level SEO.
- `Business` has legal/verification fields but not rich profile fields such as description, website, Instagram, gallery, logo, address, social links, or public slug.
- The audit does not include profile content samples, so exact field-level mapping cannot be confirmed from current files.

Needs decision:

- Which `profile` posts are personal users vs businesses/vendors?
- Should business profile content become `Business`, `Organizer`, `Place`, or a future `BusinessProfile` model?
- Should profile URLs be preserved via redirects?
- Profile media is in scope. Decide how it attaches to `USER` and `BUSINESS` targets after profile classification.

## Places

`Place` is one of the strongest target models.

Ready:

- Title, short description, description.
- City, geo coordinates, Google place ID, address JSON, formatted/custom/display address.
- Phones, website, Instagram, reels.
- Category, primary category, subcategories, age tags, visit formats, activity types.
- Opening hours via normalized `OpeningHours` tables.
- Status, moderation, claim requests, business owner, group/hierarchy.
- SEO fields and slug history.
- Images and reviews.

Requires transformation:

- WP `location` JSON to `lat`, `lng`, address fields, city/district/metro resolution.
- `work_hours` JSON to `OpeningHours`, rules, intervals, and exceptions.
- `gallery` and `logo` attachment IDs to `PlaceImage`, `MediaAsset`, `MediaUsage`.
- `places_category`, `features-*`, `age`, `district`, `metro`, `neighbourhood`, `city` taxonomies to `EventCategory`, `PlaceSubcategory`, discovery signals, `District`, `MetroStation`, and `City`.
- `claim-listing`, `booking-place-set`, `voxel:verified`, `voxel:priority` require product decisions.

Potential field loss:

- Voxel view/follow/wall stats.
- RankMath primary taxonomy markers if not converted.
- WP attachment alt/caption if media import does not copy metadata.
- Original WP post author if no legacy user mapping.

## Events

`Activity` is the target for WordPress `events`.

Ready:

- Event title, short description, description.
- Status, type, format, schedule mode, next occurrence.
- `scheduleJson` for complex schedules plus `ActivitySession` for concrete sessions.
- Venue through `EventVenue`, and optional link to `Place`.
- Age ranges/tags, price text/numeric range, category/genre/program categories.
- Contact phones, booking settings, discovery signals, SEO fields, slug history.

Requires transformation:

- Phoenix v1 imports only non-past eligible events. Past events are excluded.
- Event images are not migrated, even for active events.
- WP `event_date` arrays to `scheduleJson`, `ActivitySession`, `nextOccurrenceAt`, and `scheduleMode`.
- `publish`, `draft`, and other non-past statuses to mamaGo `ContentStatus`, after v1 eligibility filtering.
- `event-place-name`, `location`, and `adress-event-place` to `EventVenue` or existing `Place`.
- `event-cost` rich HTML to `priceText`, `priceDetails`, possible `priceItems`.
- Seasonal switchers and taxonomy tags to `Occasion` and `discoverySignalIds`.
- External event IDs (`external_event_id`, `external_last_updated`) require a lineage location.

Still needs decision:

- Define exact non-past event eligibility: date cutoff, timezone, and how to handle open-ended recurring data.
- Decide whether non-past draft events migrate to admin drafts or stay out of v1.
- Define redirect policy for excluded past events.

## Offers

WordPress `services` and `hb-programs` map to `Offer`. This is a final architectural decision.

Ready:

- Offer title, description, cover, video, price text/numeric price, promotion fields.
- Age range, date range, contacts, social links, SEO, slug history.
- Camp-specific fields: sessions, duration, stay duration, places count, group size, day schedule, accommodation, meals, safety, medical, transfer, what to bring.
- Party/service fields and package components.
- Booking settings and offer sessions.

Requires transformation:

- `hb-programs` program fields to camp/service offer fields.
- `services` and `uslugi` postmeta variants to Offer contact, pricing, legal, gallery and details fields.
- Offer must link to a `Place`; WP data may need relation resolution first.
- `program-age`, `services-categories`, `services-for-kids`, `theme-party`, `kids-party` taxonomies to offer type/category/discovery fields.

Gaps:

- `ImportEntityType` includes `OFFER`, but `ImportedRecord` has no `publishedOfferId`, so the existing import pipeline is not fully wired for Offer lineage.
- No explicit legacy WP offer/program ID field.

## Articles

`Article` is ready as the target for WordPress `post`.

Ready:

- Slug, title, subtitle, excerpt, content JSON, hero image, cover media, author, city/geoscope, status, scheduling, SEO, views, related place, category, tags, slug history.

Requires transformation:

- WP `post_content` and Elementor content to mamaGo `contentJson`.
- WP categories/tags to `EventCategory` with `publicationType=ARTICLE` and `DiscoveryTag`.
- `_thumbnail_id`, inline images and SEO image to media references.
- `post_author` to `User` or `authorLabel`.
- Published/draft/trash statuses to `ContentStatus`.

Potential field loss:

- Raw HTML if the block converter is lossy.
- WordPress comments if they are not in scope.
- RankMath focus keywords and SEO scores if intentionally ignored.

## Routes

`Route` and `RouteStop` exist, but the WP source representation is postmeta-heavy.

**Live-confirmed addendum (2026-07-13)**, superseding the "Ready"/"ambiguous"
framing below wherever the two disagree — see
`docs/migration/wordpress-db-inspection-2026-07-06.md` for how this was
obtained (extended `migration:inspect:wordpress-db`, run against production):

- Real per-stop keys are `title-location-N` / `description-location-N` /
  `images-location-N`, 1-based (`N` starting at 1, observed up to 11).
  `images-location-N` is a single comma-separated attachment-id string
  (e.g. `"17885,17886"`), not repeated meta rows. One real route (post
  29290) also had a bare, unsuffixed `title-location`/`description-location`/
  `images-location` — but its value duplicated stop 10's content exactly,
  confirming it's stale/duplicate data, not a genuine extra stop. The
  importer's `groupIndexedMeta()` (`src/lib/migration/adapters/wordpress-db/groupIndexedMeta.ts`)
  excludes unsuffixed/malformed-index keys for exactly this reason.
- **No per-stop WP Place reference exists.** A full, unfiltered postmeta
  dump for two real published routes (17822, 18437 — 85 rows, zero
  exceptions) confirmed this. `RouteStop.placeId` is therefore always
  `null` for imported routes in this phase — not a stub, a fact about the
  source. See `src/lib/migration/place-resolution/types.ts` for the
  exact-lineage resolver this would use if a source reference ever existed
  (its first real use case is `Event.placeIdRaw`, which does have one).
- Route-level `location` postmeta is a single JSON blob
  (`{address, latitude, longitude, map_picker}`), **not per-stop** — no
  per-stop coordinates exist in the source at all. Product decision
  (2026-07-13): this legacy blob is **not imported into the product
  `Route`/`RouteStop` model** and no Prisma field is added for it. It is
  preserved only as migration evidence in `normalizedPayload.locationRaw`
  and `normalizedPayload.rawMeta.location` (with parsed
  `normalizedPayload.location` when valid JSON), and non-empty values emit
  `ROUTE_LEVEL_LOCATION_DROPPED`.
- **`route-budget`, `route-duration`, `reels-route`, and route-level
  `location` are all
  deliberately not imported.** `route-duration` (2026-07-13): computed
  dynamically from stops via an API in the target product; there is no
  `Route` field for it and there will not be one, so importing the WP
  value would have nowhere real to go. `route-budget` (revised
  2026-07-13): it's a taxonomy (6 real terms, confirmed via
  `wp_term_taxonomy`, same "term attached to the post" shape as
  `places_category`) — a static term → `BudgetLevel` mapping was drafted
  and then dropped, because in the target model `Route.budgetLevel` is
  derived from per-stop prices (`summarizeRouteBudget`), which the editor
  fills in during the manual review pass over the 14 imported routes; a
  static WP-taxonomy mapping would only ever be thrown away once that
  review sets real prices, so it was never worth keeping. The real
  `route-budget` terms turn out to be price-range labels themselves (see
  `docs/migration/wordpress-db-inspection-2026-07-06.md` §10 follow-up) —
  useful context for that manual review, not for the importer. These are
  decisions, not gaps — do not resurrect any of them without a dedicated
  product task.

Ready:

- Route title, slug, age tags, city, cover image, author, status, visibility, SEO, slug history, stops, ratings.
- Route stops support place link, Google place ID, coordinates, address, custom title, note, photo, price range, address components and raw Google payload — these are `RouteStop` *target* schema capabilities, not confirmed WP source fields (see addendum above for what the source actually has).

Requires transformation:

- Repeated WP fields `title-location-*`, `description-location-*`, `images-location-*` into ordered `RouteStop` rows.
- Route image attachments need media ledger (deferred to a later phase — see Phase 4 PR sequencing).

Potential field loss:

- Route-level reels/video (`reels-route`), `route-budget`, `route-duration`, and route-level `location` — consciously dropped, see addendum.
- Arbitrary route description variants if not represented in `Route` or stop notes.

## Reviews

The approved review source is Voxel `post_reviews`.

Ready:

- `PlaceReview` can store source, source review ID, author name/avatar, 1-5 rating, text, language, publish time, status, and owner reply.

Requires transformation:

- `wp_voxel_timeline.review_score` uses decimal values such as `-2.00`, `-1.00`, `-0.67`, `1.33`, `1.67`, `2.00`; it must be mapped to 1-5 integer ratings or preserved separately.
- `content`, `details`, `user_id`, `published_as`, `post_id`, `moderation`, `created_at` need deterministic mapping.
- `reviews-on-this-place`, `place-review-relation`, and `place-or-event-review-relation` relation keys may help resolve targets.

Gaps:

- No `userId` relation on `PlaceReview`; only author strings are stored.
- No fields for Voxel likes/replies/raw score.
- No general Event/Offer review model.

Needs decision:

- Should review likes/replies be ignored?
- Should non-place reviews migrate?
- What is the rating conversion formula?

## Media

Approved image migration scope:

- User Profile.
- Business Profile.
- Place.
- Article.
- Offer (Services).
- Offer (Programs).
- Route.

Event images are explicitly out of scope for Phoenix v1.

Ready:

- `MediaAsset` supports `MIGRATED` source type, original names, mime/extension/size/dimensions, public URL, checksum/content hash, alt/title/caption, owner, status.
- `MediaUsage` supports `PLACE`, `EVENT`, `OFFER`, `ROUTE`, `ARTICLE`, `USER`, `BUSINESS`, and other entity types.
- Existing services support remote download, image processing, WebP conversion, deduplication, and usage recomputation.

Requires transformation:

- WP attachment ID to `MediaAsset` mapping.
- `_wp_attached_file` and `_wp_attachment_metadata` to source URL, dimensions, original file metadata, alt/caption/title.
- `_thumbnail_id`, `gallery`, `logo`, `cover`, route stop images and profile pictures to content-specific references for approved entity scopes only.
- The media planner must exclude event images before download/copy.

Gaps:

- No explicit `legacyWpAttachmentId`, `legacyWpPostId`, or source URL on `MediaAsset`.
- Existing imported image optimizer is for normal import records, not bulk WP attachment migration with attachment ID lineage.
- Existing `Place.logoImageId` appears to point to a `PlaceImage` or sometimes media asset by compatibility code; migration must choose one canonical convention.

## SEO

Ready:

- Main content models have SEO title, description, H1, canonical URL, OG title/description/image, robots, JSON-LD override, and canonical source.
- `SeoLlmsTxt` exists for llms.txt configuration.
- Slug history models exist for Activity, Place, Offer, Route, and Article.

Requires transformation:

- RankMath title/description/canonical/robots/OG fields to native fields.
- RankMath template variables such as `%title%`, `%page%`, `%sitename%`, `%focuskw%` need rendering or cleanup.
- `_wp_old_slug` to slug history.
- RankMath primary taxonomy keys to selected category/subcategory/genre, if useful.

Potential field loss:

- RankMath SEO score, Content AI score, focus keywords, internal link processed flags, analytic object IDs, 404 logs, GSC/GA analytics objects.
- Yoast/SEOPress fields unless explicitly mapped.

## Redirects

Current mamaGo redirect system:

- `scripts/build-migration-manifest.ts` generates `manifest.csv`.
- `src/lib/seo/redirectManifest.ts` validates `manifest.csv` at build time.
- `scripts/data/wp-redirect-map.json` is a curated static WP map.
- `src/lib/routing/wpLegacyCatchAll.ts` redirects uncovered WP tail paths to the default city hub.

Gaps:

- RankMath redirects from `wp_rank_math_redirections` are not a first-class source.
- Serialized RankMath rules include `exact`, `start`, and `contains`, while Next redirect manifests need explicit safe route rules.
- There is no database model for redirect provenance, conflict status, or review.
- Some RankMath destinations are `/`; those need editorial review to avoid flattening useful URLs.

Future requirement:

- Build a redirect normalization stage that emits reviewed manifest rows with provenance: source table, redirect ID, comparison mode, status, confidence, conflict state, and reason.

## Relations

Ready native relation targets:

- Event to Place: `Activity.placeId`, `EventVenue.placeId`.
- Offer to Place: `Offer.placeId`.
- Article to Place: `Article.relatedPlaceId`.
- Route to Place: `RouteStop.placeId`.
- Offer packages: `PackageComponent`.
- Place hierarchy/groups: `parentPlaceId`, `PlaceGroup`.

Requires transformation:

- `wp_voxel_relations` is generic and must be mapped by `relation_key`, source post type, and target post type.
- `items` is high-volume and ambiguous; it may represent collections or grouped items.
- Review-related relation keys must be resolved before importing reviews.

Needs decision:

- Which relation keys are business-critical?
- Which relation keys should be ignored?
- Should unsupported relations be preserved in a generic legacy relation table before Phase 2?

## Missing In Prisma

Do not add these in Phase 1. Do not change Prisma during design. This is only the discovered list and a proposal backlog for a separate approval step.

Likely missing or insufficient for a robust migration:

- Permanent Migration Engine concepts: adapters, source snapshots, runs, lineage, idempotency keys, and per-entity import state across non-WordPress sources.
- Legacy ID/lineage model or fields for `wp_user_id`, `wp_post_id`, `wp_attachment_id`, `wp_term_id`, `wp_redirect_id`, `wp_relation_id`, and `wp_timeline_id`.
- Broader `ImportEntityType` values: `USER`, `PROFILE`, `ARTICLE`, `ROUTE`, `MEDIA`, `REVIEW`, `REDIRECT`, `TAXONOMY`, `RELATION`.
- `ImportedRecord` links for published `Offer`, `Article`, `Route`, `User`, `MediaAsset`, `PlaceReview`, redirect rows and taxonomy rows.
- Dedicated `BusinessProfile` or `Profile` model if WP `profile` post content must survive as a public/native profile.
- Business profile public fields: logo/avatar, website, Instagram/social links, description, public slug, SEO, gallery, public address, media usages.
- Redirect rule/provenance model if redirects should be managed in DB before manifest generation.
- Legacy media mapping table for WP attachment ID to `MediaAsset`.
- Generic legacy relation staging/model if unsupported Voxel relation keys must be preserved.
- Review raw metadata fields if Voxel score, likes, replies, raw author user, and raw details must be preserved.
- Route duration field if `route-duration` is important outside SEO/content text.
- Taxonomy mapping table from WP taxonomy/term to mamaGo category/signal/tag/district/metro/city.
- Raw HTML/archive field for Article if `contentJson` conversion is lossy and exact preservation is required.

## Requires Transformation

Core transformations:

- `wp_posts` shell plus `wp_postmeta` plus taxonomy plus Voxel indexes into one native entity.
- `post -> Article`: HTML/Elementor to `contentJson`, taxonomy to article category/tags, thumbnail to media.
- `places -> Place`: postmeta JSON to geo/address/hours/media/SEO/categories.
- `events -> Activity`: only Phoenix v1 eligible non-past events; event dates to schedule/session model, location to venue/place, price HTML to price text/details, event status to `ContentStatus`; event images excluded.
- `services -> Offer` and `hb-programs -> Offer`: final transformations from service/program/camp fields to Offer fields and sessions.
- `routes -> Route`: repeated location fields to ordered `RouteStop`.
- `profile -> User/Child/Business/Organizer`: requires classification before mapping.
- `wp_users -> User`: passwordless reactivation, role/status mapping, email conflict handling.
- `wp_voxel_timeline.post_reviews -> PlaceReview`: rating scale conversion and target resolution.
- `wp_voxel_relations -> native links`: relation-key mapping.
- RankMath SEO postmeta to native SEO fields.
- RankMath serialized redirects to reviewed manifest rows.
- WP taxonomy terms to categories, genres, signals, filters, tags, city/district/metro.
- WP attachment IDs to `MediaAsset` and entity-specific image rows/usages.

## Needs Decision

Business/product decisions still required before Phase 2:

1. Exact target architecture for `profile`: personal profile vs business profile classification and whether a `Profile`/`BusinessProfile` proposal is required.
2. Which profile fields and profile URLs are business-critical.
3. How to handle email conflicts and duplicate users while still migrating all users.
4. Default role/status for migrated users and the exact reactivation UX.
5. Whether user roles/capabilities from `wp_usermeta` must be exported and preserved.
6. Exact non-past event eligibility for Phoenix v1: cutoff date, timezone, recurring/open-ended event policy.
7. Whether non-past draft events migrate to admin drafts or stay out of v1.
8. Redirect policy for excluded past events.
9. Whether WP drafts/unpublished places/articles/offers/routes migrate or only published content.
10. Which WP custom post types outside approved mapping are in scope: `page`, `collection`, `products`, `traveling`, `specialists`, `uslugi`, `offers`, `master-classes-fest`, `breakingnews`.
11. Which RankMath redirects should be preserved: active only, active plus trashed, exact only, or reviewed subset.
12. Whether redirects to `/` are acceptable or should be remapped to city/category/content hubs.
13. Whether Voxel wall/timeline/user timeline entries should be ignored, archived, or modeled.
14. Rating conversion for Voxel review scores.
15. Whether review likes/replies should be preserved.
16. Which Voxel relation keys are important enough for typed native migration.
17. Whether historical bookings/LatePoint/WooCommerce/order data are out of scope or require a separate migration phase.
18. Whether analytics counters (`views`, Voxel stats, RankMath analytics, visits) should migrate.
19. Which media sizes/originals to store for approved image scopes: original WP file, optimized WebP, or both.
20. Whether city scope defaults to Minsk when WP city is missing or ambiguous.
21. How strict taxonomy mapping should be: fail row, quarantine, or fallback to uncategorized/manual review.
22. Whether imported content should be linked to a system admin user or original WP author.
23. Whether the existing import review UI should be used for bulk migration review or whether a separate migration QA report is enough.
24. Adapter contract for future sources beyond WordPress: Google Places, CSV, Excel, Partner API and other sources.

## Migration Order

Recommended future import order:

1. Define permanent Migration Engine adapter contract and idempotency model. If Prisma changes are needed, prepare a proposal only.
2. Freeze and snapshot WordPress export; verify checksums and row counts.
3. Import/seed controlled dictionaries needed for mapping: cities, districts, metro, event/place/article categories, genres, discovery signals, tags, occasions.
4. Build migration ledger/staging records for all legacy IDs without publishing content.
5. Import all users with passwordless reactivation status and legacy user ID mapping.
6. Classify and stage profiles; decide personal/business targets.
7. Stage taxonomies and term mappings.
8. Stage media metadata for approved scopes only; do not download every attachment blindly.
9. Import media for User Profile, Business Profile, Place, Article, Offer (Services), Offer (Programs), and Route. Exclude Event images.
10. Import places, opening hours, images, SEO and slug history.
11. Import businesses/organizers/profile ownership links once profile policy is decided.
12. Import offers/programs/services linked to places/businesses.
13. Import eligible non-past events linked to places/venues/organizers, without images.
14. Import articles with media, taxonomy, SEO and slug history.
15. Import routes and route stops.
16. Import approved reviews after users/places and review relation targets exist.
17. Resolve Voxel relations into native links.
18. Generate and validate redirects from slug history, curated WP map, `_wp_old_slug`, reviewed RankMath redirects, and excluded event redirect policy.
19. Run validation reports: counts, missing media, broken links, duplicate slugs, orphaned relations, redirect conflicts, SEO field coverage.
20. Run dry-run QA review and business sign-off.
21. Run final import in production window.
22. Regenerate redirect manifest and verify representative URLs.
23. Keep rollback/read-only WP snapshot until post-migration acceptance.

## Migration Engine Architecture

The Migration Engine is a permanent mamaGo module. WordPress is only the first adapter. The same engine must support future adapters such as Google Places, CSV, Excel, Partner API and other sources.

Core invariants:

- Deterministic normalization and publishing.
- Idempotent re-import for every imported entity.
- Full provenance for every source row and target entity.
- Dry-run mode before commit mode.
- No Prisma changes during design. Any required schema change must be documented as a proposal only.

Recommended components:

1. Source adapter contract

Each adapter must expose source identity, source entity types, extraction strategy, stable external IDs, content hashes, pagination/snapshot metadata, and adapter-specific validation. WordPress is adapter `wordpress`; future adapters should follow the same contract instead of creating separate import flows.

2. Source snapshot reader

Read WordPress audit/export files or database dumps as immutable source snapshots. Validate expected files, row counts, encoding, and schema version before any normalization.

3. Legacy registry / migration ledger

Maintain a central mapping of legacy IDs to mamaGo IDs by entity type. This is required for users, posts, attachments, terms, redirects, Voxel relations, and timeline rows. It should record source hash, import status, target ID, warnings, errors, and timestamps.

For non-WordPress adapters, the same concept becomes source lineage: adapter key, external ID, source URL/reference, content hash, target entity type, target entity ID, last imported snapshot and idempotency key.

4. Extractors

Entity-specific extractors reconstruct complete WP objects from `wp_posts`, `wp_postmeta`, taxonomies, Voxel indexes, relation rows, and SEO rows. Example: a Place source object should already include post fields, meta fields, taxonomy terms, relation IDs, old slugs, gallery IDs, and SEO meta.

5. Normalizers

Convert source objects to typed native payloads for User, Place, Activity/Event, Offer, Article, Route, Review, Media, Redirect, Taxonomy, and Relation. Normalizers should not write final tables; they should emit payloads plus warnings.

6. Mapping services

Use explicit mapping tables/config for taxonomy, statuses, categories, cities, districts, metro, discovery signals, relation keys, status conversion, and review score conversion. Unknown mappings should be reported, not silently guessed.

7. Media planner

Plan media before downloading. Determine which attachment IDs are actually needed by approved content/profile scope. Build `wp_attachment_id -> planned usage -> target entity` before ingestion. Event images must be filtered out at this stage.

8. Media ingestor

Download/copy only planned media, preserve useful metadata, deduplicate by content hash, produce `MediaAsset`, entity image rows, and `MediaUsage` records. It must be retryable per attachment.

9. Entity publishers

Apply normalized payloads in dependency order. They should use the migration ledger for idempotency and should be able to update an existing target created by a previous run.

10. Relation linker

Run after entities exist. Resolve Voxel relations, route stops, article related places, event venues, offer-place links, reviews, and package components.

11. SEO and redirect builder

Populate SEO fields, slug history, and produce redirect manifest candidates. RankMath redirects must go through normalization and conflict review before becoming build-time redirect rows.

12. Validation and QA reports

Produce machine-readable and human-readable reports:

- Source vs target counts by entity/status.
- Required field failures.
- Missing media.
- Broken relation references.
- Duplicate slugs and redirect conflicts.
- Unmapped taxonomy terms.
- Dropped fields by entity.
- Rows needing business decisions.

13. Dry-run and commit modes

Dry-run should perform extraction, normalization, planning, matching and validation without writing final content. Commit mode should write using transactions and batch checkpoints.

14. Review/quarantine workflow

Rows with ambiguous mapping should be quarantined for review. The existing import review models can inspire this, but the current schema is too narrow for full Phoenix scope.

15. Observability

Every row should have provenance, warnings, errors, and import stage status. Logs should be resumable and not depend only on console output.

## Key Conclusions

- Project Phoenix should produce a permanent Migration Engine, not a WordPress-only importer.
- WordPress is the first adapter; future sources should plug into the same engine contract.
- mamaGo's native content architecture is strong for places, events, offers, articles, routes, media, SEO fields, slug history, taxonomy primitives, and bookings.
- The largest structural gap is not the target content models; it is migration lineage. There is no first-class legacy ID ledger across all entity types.
- Existing import infrastructure is useful but too narrow for Project Phoenix. It handles web-source PLACE/EVENT/OFFER flows, not full WP retirement.
- Idempotency is mandatory for every imported entity.
- All users are in scope, but passwords are not migrated and reactivation is required.
- Services and programs are both final `Offer` targets.
- Phoenix v1 excludes past events and all event images.
- Profiles are the most ambiguous approved mapping because `profile` has 536 published WP posts and no direct Prisma target.
- Media migration is feasible, but only if attachment ID mapping is introduced before entity import.
- Redirect migration is partially ready through `manifest.csv`, but RankMath redirects need a normalization/review layer.
- Voxel relations and timeline rows require explicit business triage; only `post_reviews` has an approved target.

## Found Problems

- No permanent, source-agnostic Migration Engine model/contract exists yet; current import code is narrower.
- No direct Prisma model for WordPress profile posts.
- No legacy ID fields/ledger for users, posts, media, terms, redirects, relations, or reviews.
- Existing `ImportEntityType` is too narrow.
- `ImportedRecord` lacks target links for Offer, Article, Route, User, Media, Review, Redirect and Taxonomy.
- RankMath object sample is empty, and RankMath redirects are serialized rules, not manifest-ready paths.
- `content_sample.tsv` does not include samples for several critical approved post types.
- WP taxonomy set is much wider than current one-to-one target mappings.
- Voxel relation key `items` is high-volume but ambiguous.
- Voxel review score scale does not match `PlaceReview.rating`.
- Business profile data has no obvious complete target.
- Route duration has no clear native field.
- Historical booking/commerce data exists in source schema but is not in approved scope.

## Found Risks

- Designing a WordPress-only importer would conflict with the approved permanent Migration Engine direction.
- Data loss from unexported `wp_usermeta`, comments, profile samples, and full RankMath objects.
- Incorrect owner attribution if WP authors/users are not mapped before content.
- Duplicate slugs across city/global scopes if `_wp_old_slug` and current slugs are imported without conflict checks.
- Redirect loops or bad broad redirects from RankMath `start`/`contains` rules.
- Excess media import if the engine downloads all attachments instead of only approved image scopes.
- Event images being imported accidentally unless media planning explicitly excludes them.
- Broken galleries/logos if attachment IDs are resolved after content creation instead of before.
- Taxonomy drift if terms are auto-guessed instead of curated.
- Past events leaking into Phoenix v1 if eligibility filtering is weak.
- Review score distortion if the `-2..2` Voxel scale is mapped casually to 1-5.
- Profile/business data becoming scattered or lost without a profile architecture decision.
- Build failures if generated redirect manifest falls below thresholds or contains invalid destinations.

## Questions Before Phase 2

1. What is the adapter contract for the permanent Migration Engine?
2. What Prisma proposal, if any, is needed for source-agnostic lineage and idempotency?
3. Should `ImportEntityType` and `ImportedRecord` be expanded for the full Phoenix scope, or should a separate engine schema be proposed?
4. What is the target architecture for 536 WP `profile` posts?
5. Which profile fields, profile URLs, and profile media attachments are business-critical?
6. How should duplicate user emails and account conflicts be handled while still migrating all users?
7. What exact reactivation UX should imported users receive after first authorization?
8. What is the non-past event eligibility rule for Phoenix v1?
9. Should non-past draft events migrate to admin drafts?
10. What redirect policy should excluded past events receive?
11. Should unpublished places/articles/offers/routes migrate as drafts/archive, or be ignored?
12. Which non-approved WP post types must be preserved?
13. Should WP pages migrate to `Page`, `Article`, redirects, or be manually recreated?
14. What is the canonical review rating conversion from Voxel score to mamaGo rating?
15. Should Voxel wall/timeline/user timeline entries be preserved?
16. Which Voxel relation keys are in scope?
17. Should historical bookings/LatePoint/WooCommerce data be migrated?
18. Should RankMath active redirects only be migrated, or also trashed/inactive rows for review?
19. Are redirects to `/` acceptable?
20. Should RankMath/Yoast/SEOPress scores and focus keywords be preserved anywhere?
21. What is the default city policy for missing/ambiguous WP city data?
22. What is the taxonomy mapping approval process?
23. Should imported content be assigned to original WP authors or a system import owner?
24. Is exact raw HTML preservation required when converting articles to `contentJson`?

## Session Addendum (2026-07-05): Reconciliation with Import-Module MVP Discussion

A separate working session on 2026-07-05 independently re-derived much of this
Phase 1/2/3 analysis from scratch (without reading these files first) and
reached one conclusion that directly conflicts with the approved Phase 3
Executive Decision below. This addendum reconciles the two and records what
that session added that is genuinely new.

### The conflict — must be resolved before Phase 2/3 implementation starts

The 2026-07-05 session concluded: "use the existing `src/server/modules/import/*`
pipeline for the WordPress MVP, keep Phoenix (`Migration*` models,
`src/lib/migration/core/*`) as a future engine, not for this transfer."

This directly contradicts the **Executive Decision** already recorded in
`docs/migration/migration-ledger-schema-proposal.md`: *"The minimal permanent
ledger for Phoenix v1 should use separate `Migration*` tables, not the
existing `Import*` tables"* — precisely because `ImportEntityType` only
covers `PLACE`/`EVENT`/`OFFER`, `ImportedRecord` only links to
`publishedPlaceId`/`publishedActivityId`, and there is no media/relation/
redirect/generic lineage model in the `Import*` schema. That reasoning has
not changed and still applies.

Additionally, the `Migration*` schema from that proposal is **already
migrated**, not merely proposed: commit `82c63b4b` ("feat(migration): add
Project Phoenix foundation", 2026-07-04) added `docs/migration/*.md`,
`prisma/schema.prisma` changes, and the SQL migration
`prisma/migrations/20260704020116_add_migration_engine_tables/`. The tables
exist in the database today. Only the runtime (`src/lib/migration/core/*`
adapters, orchestrator, publisher) is still a stub with no registered
adapters and a deliberately-throwing `runMigrationCommit()`.

**Recommendation:** build the WordPress adapter against the `Migration*`
ledger (Phoenix), not the `Import*` pipeline. Reusing `Import*` for a "quick"
WordPress MVP would mean building throwaway lineage/media/redirect handling
that the Phase 3 proposal already designed correctly and that already exists
as real tables. The 2026-07-05 session's `SourceAdapter` sketch (`connect()`,
`discover()`, `fetch()`, `media()`, `supportsIncrementalSync()`) should be
treated as a rough draft, superseded by the much more complete **Adapter
Contract Proposal** in `docs/migration/migration-engine.md` (adapter
metadata, stage-oriented `Discover`/`Extract`/`Normalize`/`Validate
hints`/`Plan hints`, source record envelope, canonical normalized domains).
This is a correction to that session's memory record
(`project_wp_migration_engine_decision.md` / `project_wp_migration_mapping.md`
in the Claude memory store) — treat those as superseded by this addendum
where they conflict, and as still-useful color where they add detail these
Phase 1-3 docs don't cover (see below).

**Open item, not yet resolved:** whether "Import Job with modes
Preview/Migration/Sync/Refresh" (the 2026-07-05 session's proposed unification
of one-shot migration and recurring sync) should replace, or sit alongside,
this document's dry-run/commit mode design. Phoenix's adapter capability flag
for "incremental sync" already anticipates recurring sources (e.g. a future
Google Places adapter), so the concepts are compatible, but no one has
explicitly merged them. Track as an open question for Phase 2 implementation
planning, not blocking Phase 1.

### What the 2026-07-05 session added that is new and not yet in this document

These are genuine additions, not duplicates — worth folding into the
relevant sections above when this document is next revised for
implementation:

- **Place field-import classification**, more granular than the existing
  "Ready / Requires transformation / Potential field loss" framing:
  - Auto-import, no review: name, short/full description, cover image,
    gallery, address, coordinates, phones, email, website, socials, work
    hours (as-is), age range, price, categories, slug, SEO, old URL.
  - Auto-import but flagged for review: ambiguous category mapping,
    district, metro, occasions/signals, organizer, related places, `unp`
    when validation fails.
  - Never auto-import: **place logo only** — cover/gallery are still
    auto-imported (this narrows, but does not contradict, the existing
    "Approved image scopes" table, which already lists Place: Yes for
    images generally; logo is a sub-exclusion within that scope). Reasoning:
    logos are brand assets and frequently stale/wrong-aspect-ratio/superseded,
    unlike cover/gallery which remain useful content even if imperfect.
- **Image provenance tracking** (not previously specified): every imported
  image should carry a status flag, `Imported` at import time, flipping to
  `Manual` if an editor replaces it. Enables a later query for "all places
  still on original WordPress images" without re-running the migration.
  This should be designed into `MigrationMediaAsset`'s binding fields (or
  an equivalent) from the first WordPress import pass, not retrofitted.
- **Editor-resolves-ambiguity principle**: explicitly confirmed that
  `work_hours` raw-format parsing edge cases, `unp` placement, `post_author`
  → `User` mapping ambiguity, and `Article.geoScope`/`cityId` defaulting are
  *not* adapter-design blockers — imported records land in a review queue as
  drafts, and the editor resolves these manually before publish, same as the
  existing family.by import flow. This is consistent with (and reinforces)
  this document's own "Review/quarantine workflow" component and the
  `MigrationReviewTask` model in the ledger proposal — it does not change
  the schema design, just confirms the adapter/normalizer should not add
  heuristics for these specific fields.
- **Long-term product framing** ("Content Acquisition Engine" instead of
  "Import"): the WordPress/Google Places/CSV/etc. engine's job is broader
  than moving data — quality scoring, dedup, category/place matching, image
  sourcing, provenance. This matches this document's existing "permanent
  Migration Engine, not a WordPress-only importer" framing and the planned
  adapter roster; the main new idea is a possible future rename of the
  admin section away from "Импорт" once the module's scope actually broadens
  to match — not an implementation task now.

## WordPress DB Inspection Notes (2026-07-05, read-only SSH/SQL verification)

This section records what was actually confirmed by connecting read-only to
the live WordPress MySQL database over SSH, superseding earlier assumptions
that a WXR/XML export would be the primary migration source.

**WXR is not needed as the primary source.** Read-only SQL access to the live
WordPress database is available and confirmed working (`wp_posts`,
`wp_postmeta`, `wp_terms`, `wp_term_taxonomy`, `wp_term_relationships`,
`wp_users`, `wp_usermeta`, `wp_rank_math_redirections` and related RankMath
tables, `wp_voxel_relations`, `wp_voxel_timeline`, and the full set of
`wp_voxel_index_*`/`wp_voxel_price_index_*` tables are all present and
queryable). Live `post_type`/`post_status` aggregate counts were confirmed
and closely match the earlier TSV-based audit (`post` publish=115, `places`
publish=82/draft=11/unpublished=187, `hb-programs` publish=90, `routes`
publish=14, `profile` publish=536, `attachment` inherit=9620; `events`
publish=28/expired=2864, drifted slightly from the 2026-07-03 audit's
35/2857 as events naturally expired in the intervening two days). A
WordPress-focused adapter should target this live DB as the primary source;
the previously-built `wordpress-wxr` adapter (discover-only, untested against
real data) remains available as a fallback/experimental path, not the
primary one.

**`wp_voxel_index_post` was inspected and is a search index, not a
structured field source.** 115 rows (one per `post`). Columns: `id, post_id,
post_status, priority, _keywords (text)`. `_keywords` is a single
concatenated free-text blob (description + address + categories mixed
together, not machine-parseable back into fields). This table should not be
treated as a source for Article fields — `wp_posts` plus `wp_postmeta` plus
RankMath remain the real source, as already documented above.

**`wp_voxel_index_places` was inspected and is partially useful, not a
general Place field source.** 93 rows (82 publish + 11 draft, matching
`wp_posts` counts for `places`). Columns: `id, post_id, post_status,
priority, _keywords, _location (POINT), _range (smallint),
activity_timeline (datetime)`. The initial hypothesis that Voxel might have
already denormalized phone/work_hours/category/price/age into this index did
**not** hold — none of those fields exist here. The one genuinely useful
column is `_location`, a native MySQL `POINT` type: this is a better
coordinate source than parsing the free-text `location` WP postmeta value by
hand, extractable via `ST_X(_location)` / `ST_Y(_location)`.

**Resulting source-of-truth decision for the WordPress DB adapter:**

For `Place`:
- Coordinates → `wp_voxel_index_places._location` via `ST_X`/`ST_Y`.
- Phone, work hours, description, short description, `unp`, gallery/cover
  media references → `wp_postmeta` (join on `post_id`), as already planned.
- Categories/tags → `wp_terms` + `wp_term_taxonomy` + `wp_term_relationships`.

For `Article`:
- Base fields (title, content, dates, author, slug, status) → `wp_posts`.
- SEO fields, featured image reference, old slugs → `wp_postmeta` (RankMath
  keys, `_thumbnail_id`, `_wp_old_slug`).
- `wp_voxel_index_post._keywords` may be used at most as a reference/fallback
  search blob, never as a primary field source.

**Warning for future adapter work:** do not build adapter assumptions on any
`wp_voxel_index_*` table's contents without first inspecting its actual
columns via `information_schema.columns` (or an equivalent inspection step)
against the live database. This inspection showed the Voxel index tables are
useful mainly for geo (`_location`) and search (`_keywords`), not as a
general substitute for postmeta-based field normalization. The same caution
applies to any other `wp_voxel_index_*`/`wp_voxel_price_index_*` table before
relying on it in a normalizer.

STOP: Phase 1 ends here. Do not implement import code, schema changes, migrations, or database writes until Phase 2 is approved.
