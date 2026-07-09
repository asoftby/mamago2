# Project Phoenix: Permanent Migration Engine

Phase 2: Architecture and Proposal

This document is architecture only. It does not define an importer implementation, does not change Prisma schema, does not create migrations, does not write to the database, and does not push any changes.

## Architecture Overview

Project Phoenix is a permanent mamaGo Migration Engine. WordPress is the first adapter, not the reason for the engine to exist. The engine must later support Google Places, CSV, Excel, Partner API, and other sources without rebuilding the migration architecture.

The strategic goal is to migrate business data into native mamaGo models and make WordPress fully unnecessary after migration. The engine therefore does not preserve WordPress structures as product structures. It preserves source lineage and auditability, while publishing normalized entities into mamaGo-native tables.

Approved Phase 1 transformations remain binding:

| Source | Target |
| --- | --- |
| WordPress `services` | `Offer` |
| WordPress `hb-programs` | `Offer` |
| WordPress users | `User`, with password reset/reactivation flow |
| WordPress event images | Not migrated |
| WordPress past events | Not part of Phoenix v1 |

Approved image scopes:

| Scope | Migrated |
| --- | --- |
| User Profile | Yes |
| Business Profile | Yes |
| Place | Yes |
| Article | Yes |
| Offer from Services | Yes |
| Offer from Programs | Yes |
| Route | Yes |
| Event | No |

The engine has five durable concerns:

1. Adapter abstraction for source-specific discovery, extraction, normalization, and planning.
2. Migration ledger for idempotency, resume/retry, source lineage, and auditability.
3. Target planning that separates dry-run decisions from commit writes.
4. Media pipeline that filters approved image scopes before any migration work.
5. Reporting and quarantine so manual decisions are explicit and repeatable.

The engine should publish data only through mamaGo-native domain boundaries. It should not create generic WordPress-shaped content in the target system.

## Component Responsibilities

| Component | Responsibility |
| --- | --- |
| Migration Orchestrator | Owns run lifecycle, dependency order, dry-run/commit mode, checkpoints, resume/retry, and report generation. |
| Adapter Registry | Registers source adapters by stable adapter key, version, capabilities, and supported source entity types. |
| Source Adapter | Discovers source records, extracts raw payloads, exposes stable source identifiers, computes source hashes, and normalizes records into the Phoenix canonical model. |
| Normalization Layer | Converts source-specific fields into target-agnostic normalized payloads, such as normalized user, place, offer, article, route, media reference, relation, and redirect plans. |
| Validation Layer | Validates source payloads, normalized payloads, dependency references, target readiness, uniqueness, policy constraints, and manual-review requirements. |
| Planning Layer | Produces deterministic write plans, media plans, relation plans, redirect plans, and quarantine decisions without mutating target content in dry-run mode. |
| Ledger and Lineage Store | Stores source identity, target identity, content hashes, lifecycle status, idempotency keys, errors, decisions, and repeat-import history. |
| Publisher | Applies planned writes in commit mode only, using lineage/idempotency keys to update existing targets instead of creating duplicates. |
| Media Pipeline | Plans, filters, deduplicates, imports, and binds media only for approved scopes. |
| Relation Linker | Resolves source references to target IDs after dependencies are published, then creates native mamaGo links. |
| Redirect/SEO Planner | Converts legacy URLs, slug history, RankMath redirects, canonical metadata, and excluded-content redirect rules into the approved mamaGo redirect/SEO strategy. |
| Reporter | Emits machine-readable reports, human summaries, manual-review reports, and quarantine reports. |

## Data Flow

The high-level flow is intentionally source-agnostic:

1. Configure a migration source with adapter key, source identity, credentials/configuration reference, city/scope, and run policy.
2. Create a migration run in either dry-run or commit mode.
3. Adapter discovers source records and emits stable source record envelopes.
4. Adapter extracts raw payloads and records source hashes.
5. Normalization layer converts raw payloads to Phoenix normalized records.
6. Validation layer checks required fields, source policies, target constraints, dependency availability, and approved scope.
7. Planning layer creates deterministic entity plans, media plans, relation plans, and redirect plans.
8. In dry-run mode, the engine stops before target writes and emits reports.
9. In commit mode, the publisher applies plans in dependency order using ledger-backed idempotency.
10. Relation linker binds cross-entity references after dependent targets exist.
11. Reporter emits final reports and unresolved manual-review/quarantine artifacts.

Required dependency order:

| Order | Domain | Reason |
| ---: | --- | --- |
| 1 | Users | Ownership, authorship, reviews, and profile data depend on user identity. |
| 2 | Profiles | User and business profile data establishes owners, organizers, and business context. |
| 3 | Taxonomies | Places, offers, events, articles, routes, and discovery metadata depend on canonical taxonomies. |
| 4 | Media Plan | Media eligibility and binding targets must be planned before copying/downloading files. |
| 5 | Media | Approved assets must exist before they can be bound to content entities. |
| 6 | Places | Offers, events, routes, reviews, and relations often reference places. |
| 7 | Offers | Services and programs become native offers and may depend on places/businesses. |
| 8 | Events | Phoenix v1 includes only eligible non-past events and excludes event images. |
| 9 | Articles | Articles can reference users, places, offers, routes, and SEO media. |
| 10 | Routes | Routes depend on places/media/taxonomies and can create route stops. |
| 11 | Reviews | Reviews depend on users and places. |
| 12 | Relations | Generic source relations can be linked only after targets exist. |
| 13 | SEO/Redirects | Slug history, canonical URLs, and redirect rules depend on final published targets. |

## Ledger Design Proposal

Idempotency is a hard requirement. The engine needs a durable ledger that can answer these questions:

- Have we seen this exact source record before?
- Has this source record already produced a target entity?
- Did the source payload change since the last successful run?
- Is the current target the result of this source record or a manual/user-created entity?
- Can this record be retried without duplicating target content?
- Which source fields and decisions produced the current target?
- Which manual decisions, quarantines, and failures block completion?

### Existing Import Models Assessment

The current Prisma schema contains `ImportSource`, `ImportRun`, `ImportedRecord`, `ImportReviewTask`, and `ImportFieldOverride`. They are useful prior art, but they are not sufficient as the Phoenix ledger.

Current limitations:

| Existing model area | Limitation for Phoenix |
| --- | --- |
| `ImportEntityType` | Supports only `PLACE`, `EVENT`, and `OFFER`. Phoenix must cover users, profiles, taxonomies, media, articles, routes, reviews, relations, and redirects. |
| `ImportedRecord` target links | Links only to `publishedPlaceId` and `publishedActivityId`; no generic target reference or multi-target lineage. |
| Source abstraction | Oriented around website/RSS/API/CSV source runs, not permanent adapter contracts with versioned normalized output. |
| Pipeline statuses | Has parse/normalize/match/review statuses, but not the approved Phoenix lifecycle states. |
| Media lineage | No durable source attachment map, approved scope gate, dedup state, or binding plan. |
| Relation lineage | No first-class source relation plan or native target relation lineage. |
| Redirect lineage | No first-class legacy redirect/source URL lineage. |
| Resume semantics | Run counters exist, but not enough per-record checkpoints for idempotent cross-domain resume/retry. |

### Decision

Phase 2 design decision: propose separate Phoenix migration models rather than extending the current `ImportSource` / `ImportRun` / `ImportedRecord` tables for Phoenix v1.

Reasoning:

- Phoenix is a permanent migration subsystem, not only the existing content import workflow.
- The current models can remain available for the existing import/review feature.
- Extending the existing enums and target links would overload a narrower model and create backwards-compatibility risk.
- Phoenix needs source-agnostic lineage across all target entity types and, in some cases, one source record producing multiple target records.
- Phoenix needs strict media, relation, and redirect lineage that should not be forced into a single generic `ImportedRecord.applyResult` JSON field.

The current import models can still be reused conceptually, and later implementation may share UI patterns, review queues, and field-lock ideas. They should not be the core Phoenix ledger.

### Ledger Model Concepts

The ledger should be split into source/run/record lineage plus specialized plans:

| Concept | Purpose |
| --- | --- |
| Migration Source | A configured source system, such as WordPress production export, Google Places account, CSV upload, Excel workbook, or Partner API feed. |
| Migration Run | One execution attempt against a source, with mode, status, adapter version, snapshot metadata, counters, and reports. |
| Source Record | One durable source entity envelope with stable source identity, source hash, lifecycle status, normalized payload reference, target plan, and error/quarantine state. |
| Lineage Link | Stable mapping between source identity and target entity identity across runs. This is the main idempotency anchor. |
| Media Asset Map | Stable mapping between source attachment/file identity and target media asset identity, including dedup hashes and approved scope. |
| Relation Plan | Stable mapping from source relation identity to native target relation intent and linked result. |
| Redirect Plan | Stable mapping from legacy URL or redirect rule to target URL/redirect decision. |
| Quarantine Item | Durable manual or validation block that prevents unsafe publication. |
| Report Artifact | Stored run output for machine, human, manual-review, and quarantine reports. |

### Lifecycle States

Each source record should have one primary lifecycle state:

| State | Meaning | Allowed next states |
| --- | --- | --- |
| `discovered` | Adapter found a stable source identity, but raw payload is not yet extracted. | `extracted`, `failed`, `quarantined` |
| `extracted` | Raw payload was captured or referenced and source hash was computed. | `normalized`, `failed`, `quarantined` |
| `normalized` | Source payload was transformed into Phoenix normalized shape. | `validated`, `failed`, `quarantined` |
| `validated` | Normalized payload passed automated validation or produced explicit manual-review requirements. | `planned`, `quarantined`, `failed` |
| `planned` | Deterministic write/media/relation/redirect plan exists. | `published`, `quarantined`, `failed` |
| `published` | Primary target entity write succeeded in commit mode, or dry-run equivalent was simulated. | `linked`, `completed`, `failed` |
| `linked` | Dependent links, media bindings, relations, and redirects were connected. | `completed`, `failed`, `quarantined` |
| `completed` | Record is fully imported or intentionally skipped with durable lineage and report state. | Terminal, unless source hash changes in a later run |
| `quarantined` | Record is blocked by validation, policy, missing dependency, ambiguity, or manual-review requirement. | `validated`, `planned`, `failed` after resolution/retry |
| `failed` | Processing failed due to an operational or unexpected error. | Retry from last safe checkpoint |

Lifecycle status is not the same as adapter extraction status or target publication status. A record may also have sub-statuses for media, relation, redirect, and manual review plans.

### Idempotency Keys

Every importable unit needs a deterministic idempotency key:

| Unit | Idempotency key inputs |
| --- | --- |
| Source record | Adapter key, source namespace, source entity type, stable external ID or canonical source URL. |
| Target entity plan | Source record key, target entity type, target role if one source record creates multiple targets. |
| Media asset | Adapter key, source attachment ID if present, canonical source URL, content hash when available. |
| Relation | Adapter key, source relation ID or deterministic pair of source endpoints plus relation key. |
| Redirect | Adapter key, source redirect ID or canonical source path plus match mode. |

The publisher must use lineage first, then target uniqueness rules, then manual-review conflict handling. It must never create a duplicate only because a previous run crashed after target creation but before final report completion.

## Adapter Contract Proposal

Adapters are source-specific packages that produce source-agnostic Phoenix records. WordPress is the first adapter. Future adapters should fit the same contract without introducing WordPress concepts into the engine core.

### Adapter Metadata

Each adapter must declare:

| Field | Purpose |
| --- | --- |
| Adapter key | Stable key such as `wordpress`, `google_places`, `csv`, `excel`, or `partner_api`. |
| Adapter version | Version of extraction/normalization behavior used for reproducibility. |
| Display name | Human-readable source type name. |
| Supported source entity types | Source-level entities the adapter can emit. |
| Supported target domains | Target domains the adapter can plan for: users, places, offers, events, articles, routes, reviews, media, relations, redirects. |
| Capabilities | Pagination, snapshots, incremental sync, media extraction, relation extraction, redirect extraction, taxonomy extraction, raw payload storage. |
| Stable ID policy | How source identities are generated and when they are considered immutable. |
| Hash policy | How source content hash is computed and which fields are excluded from hash noise. |
| Timezone policy | How source dates are interpreted. |
| Deletion policy | Whether missing source records imply deletion, archival, or no action. |

### Adapter Stages

The engine calls adapters through stage-oriented operations:

| Stage | Adapter responsibility | Engine responsibility |
| --- | --- | --- |
| Discover | Enumerate stable source identities and lightweight metadata. | Persist discovered records and checkpoints. |
| Extract | Load raw payloads, source timestamps, source URLs, media refs, relation refs, and redirect refs. | Store raw references and hashes. |
| Normalize | Convert source payloads into Phoenix normalized shapes. | Validate schema and policy. |
| Validate hints | Provide source-specific warnings, confidence, and ambiguity reasons. | Apply shared validation and quarantine decisions. |
| Plan hints | Suggest target type, dependency refs, media bindings, relation intents, and redirect intents. | Produce final deterministic plans. |

Adapters should not write mamaGo target entities directly. All target writes belong to the Phoenix publisher in commit mode.

### Source Record Envelope

Every discovered or extracted record must provide:

| Field | Requirement |
| --- | --- |
| Adapter key | Required. |
| Source namespace | Required. Distinguishes environments, exports, partners, or files. |
| Source entity type | Required. Examples: `wp_user`, `wp_post:places`, `wp_post:hb-programs`, `wp_attachment`, `google_place`, `csv_row`. |
| Source external ID | Required when the source has stable IDs. |
| Source stable key | Required fallback for sources without stable IDs, such as CSV/Excel rows. |
| Source URL | Optional but preferred for audit and redirects. |
| Source updated at | Optional; used for incremental decisions. |
| Source hash | Required after extraction. |
| Raw payload reference | Required after extraction unless payload is embedded in the ledger by policy. |
| Normalized entity kind | Required after normalization. |
| Dependency references | Optional list of source refs this record depends on. |
| Media references | Optional list of source media refs. |
| Relation references | Optional list of source relation refs. |
| Redirect references | Optional list of source redirect refs. |
| Warnings | Optional structured list for reporting and manual review. |

### Canonical Normalized Domains

The engine should define normalized domain payloads for:

| Domain | Examples |
| --- | --- |
| User | Email, display name, phone, avatar ref, source role hints, reactivation required. |
| User Profile | Avatar, children hints, interests, profile fields. |
| Business Profile | Business identity, legal info, organizer hints, logo/cover refs. |
| Taxonomy | Source term, target taxonomy kind, slug, labels, parent refs. |
| Place | Name, slug, address, geo, city, district/metro refs, contacts, opening hours, place images, SEO. |
| Offer | Name, slug, offer type, source subtype, pricing, age, capacity, schedule hints, place/business refs, offer images, SEO. |
| Event | Name, slug, schedule, venue, price, organizer, category, SEO, no event image bindings. |
| Article | Title, slug, content, author ref, cover/gallery refs, SEO. |
| Route | Title, slug, description, stops, budget/duration, route image refs, SEO. |
| Review | Author ref, place ref, source score, normalized score, text, moderation status. |
| Relation | Source endpoints, relation key, native target relation intent. |
| Redirect | Source URL/rule, target URL/ref, match mode, status, priority. |

## Dry-Run and Commit Mode

Dry-run and commit mode must use the same adapter, normalization, validation, and planning logic. Divergence between dry-run and commit is a risk because it makes reports untrustworthy.

### Dry-Run Mode

Dry-run mode:

- Creates or updates only Phoenix operational artifacts in the future implementation, such as run records, ledger checkpoints, and reports, if approved by schema and product policy.
- Does not write target content tables such as `User`, `Place`, `Offer`, `Activity`, `Article`, `Route`, `PlaceReview`, media binding tables, or redirect manifests.
- Produces deterministic plans with proposed target actions: create, update, link, skip, quarantine, fail.
- Resolves lineage and target matches as read-only checks.
- Emits full reports with expected writes, conflicts, manual review, and quarantine counts.
- Must be safe to run repeatedly against the same source export.

For this Phase 2 document, no dry-run execution is performed.

### Commit Mode

Commit mode:

- Reuses the dry-run plan logic.
- Applies target writes only after records are validated and planned.
- Writes lineage before or atomically with target publication whenever possible.
- Uses idempotency keys and lineage to update or skip existing targets.
- Applies media bindings only for approved scopes.
- Links relations only after all source endpoints have target lineage.
- Writes redirect/SEO artifacts only after final target URLs are known.
- Emits the same report families as dry-run, with actual target IDs and applied results.

Commit mode must support partial progress. A crash after publishing a target entity but before completing the run must be recoverable without duplication.

## Resume and Retry

Resume/retry is based on durable per-record lifecycle and lineage, not only run-level status.

### Resume After Crash

On resume, the orchestrator should:

1. Load the run and source configuration.
2. Verify adapter key/version compatibility.
3. Recompute or verify source snapshot metadata where available.
4. Find records not in `completed` state.
5. For each record, inspect lifecycle state, target lineage, media state, relation state, and redirect state.
6. Continue from the last safe checkpoint.
7. For records with published target lineage but incomplete links, skip target creation and resume binding/linking.
8. Rebuild reports from ledger state.

### Retry After Failure

Retry policy:

| Failure type | Retry behavior |
| --- | --- |
| Transient extraction/media/network failure | Retry from failed stage with backoff and attempt count. |
| Validation failure | Move to quarantine unless caused by missing dependency that later resolves. |
| Target uniqueness conflict | Quarantine with manual-review task unless deterministic lineage proves update target. |
| Media dedup conflict | Reuse existing media asset when content hash and source lineage are compatible; otherwise quarantine. |
| Relation endpoint missing | Retry after dependency domain finishes; quarantine if endpoint is excluded. |
| Adapter version mismatch | Require explicit run policy: continue with old adapter, replan with new adapter, or start a new run. |

Retry must preserve original source identity and run history. It must not create new logical records for the same source entity unless the source identity policy changes intentionally.

## Media Pipeline

Media is handled as a first-class plan, not as incidental fields on content import. The engine must filter media before download/copy/binding so disallowed assets never enter the migration path by accident.

### Media Planning

The media planner receives media refs from normalized records and creates media plan items with:

| Field | Purpose |
| --- | --- |
| Source media identity | WordPress attachment ID, source URL, file path, or partner media ID. |
| Source owner record | Record that requested the media. |
| Approved scope | One of the explicitly allowed Phoenix scopes. |
| Intended target entity | Target entity type and planned target role, such as avatar, logo, cover, gallery, route stop image. |
| Source URL/path | Fetch/copy location. |
| Source metadata | Alt text, caption, MIME type, dimensions, original filename, source modified time. |
| Hash policy | Source hash and content hash when available. |
| Plan status | Planned, skipped, duplicate, blocked, imported, bound, failed, quarantined. |

### Approved Scope Filter

Allowed scopes:

| Scope | Example bindings |
| --- | --- |
| `user_profile` | `User.avatarUrl` or future avatar media relation. |
| `business_profile` | Business logo/cover or organizer profile media. |
| `place` | `PlaceImage`, `MediaUsage`, cover/gallery. |
| `article` | Article cover/OG image/content images as approved. |
| `offer_services` | Offer image/gallery for source `services`. |
| `offer_programs` | Offer image/gallery for source `hb-programs`. |
| `route` | Route cover/gallery/route stop images. |

Blocked scope:

| Scope | Policy |
| --- | --- |
| `event` | Always skip in Phoenix v1, including active/future events. Report as policy-skipped, not failed. |

Any media ref without an approved scope must be skipped or quarantined before import.

### Attachment Mapping

For WordPress, attachments should be mapped separately from content records:

- `wp_posts.ID` for `attachment` becomes the source media identity.
- `_wp_attached_file` and `_wp_attachment_metadata` provide file path, variants, dimensions, and thumbnails.
- `_wp_attachment_image_alt` provides alt text when available.
- Content fields such as `_thumbnail_id`, `gallery`, `logo`, `cover`, and route image fields reference attachment IDs.
- A single attachment can bind to multiple target entities if the scope is approved for each binding.

For non-WordPress adapters, the same media map concept applies using the adapter's source media identity.

### Deduplication

Deduplication order:

1. Existing media lineage by adapter key and source media identity.
2. Existing media asset by strong content hash.
3. Existing media asset by canonical source URL when content hash is unavailable.
4. Manual review if metadata conflicts or two different files claim the same source identity.

Deduplication must not depend only on filename. Filenames from WordPress uploads and partner feeds are not globally unique.

### Binding to Entities

Media binding happens after the target entity exists:

| Target | Binding examples |
| --- | --- |
| User Profile | Avatar/profile image. |
| Business Profile | Logo, cover, organizer image. |
| Place | `PlaceImage`, cover/gallery role, `MediaUsage`. |
| Article | Cover image, content image refs, SEO/OG image if approved. |
| Offer | Offer gallery/cover/media usage for services/programs. |
| Route | Route cover/gallery, route stop image refs where target supports them. |

Event media bindings are not created. If an event record contains image refs, the media planner marks them as policy-skipped.

## Validation Pipeline

Validation is layered so source-specific problems, target policy problems, and operational problems are visible separately.

| Layer | Checks |
| --- | --- |
| Adapter/source validation | Required source IDs, raw payload integrity, source hash availability, date parsing, media ref shape, relation endpoint shape. |
| Normalized schema validation | Required normalized fields, target domain shape, enum values, URL/email/phone formats, location shape. |
| Policy validation | Approved mappings, no past events in Phoenix v1, no event images, all users migrated with password reactivation, services/programs become offers. |
| Dependency validation | User/profile/taxonomy/media/place/offer/event/article/route/review/relation prerequisites. |
| Target validation | Existing target match, uniqueness, slug conflicts, city scope, taxonomy availability, required business ownership. |
| Media validation | Approved scope, fetchability/copyability, MIME type, dimensions if required, dedup result. |
| SEO/redirect validation | Source URL normalization, redirect loop detection, destination availability, excluded content behavior. |
| Manual-review validation | Ambiguous matches, unsupported relation keys, score conversion uncertainty, legal/business profile ambiguity. |

Validation result categories:

| Result | Meaning |
| --- | --- |
| Pass | Record can move to planning. |
| Warning | Record can continue, but report must include a warning. |
| Manual review | Record is not safe to publish until a human decision is captured. |
| Quarantine | Record is blocked by data/policy/dependency issues. |
| Failure | Unexpected operational error occurred. |

## Reporting

Reports are not secondary output. They are part of the migration contract because Phoenix must be auditable and rerunnable.

### Machine Report

Machine report format should be structured JSON or NDJSON and include:

- Run metadata: source, adapter version, mode, started/finished timestamps, snapshot/hash metadata.
- Counters by lifecycle state, source entity type, target entity type, and dependency group.
- Per-record source identity, lifecycle state, source hash, target action, target ID if committed, warnings, errors, quarantine reason.
- Media plan and result counters by approved scope.
- Relation and redirect plan counters.
- Idempotency decisions: created, updated, skipped unchanged, linked existing, quarantined conflict.

Machine reports must be suitable for automated diffing between dry-run and commit.

### Human Report

Human report format should be Markdown and include:

- Executive summary.
- Scope included/excluded.
- Counts by domain.
- Top warnings and risks.
- Created/updated/skipped/quarantined/failed summaries.
- Media policy summary, especially event image skips.
- Past event exclusion summary.
- Manual decisions required before commit.
- Links or references to machine/quarantine artifacts.

### Manual Review Report

Manual review report should list records that need a human decision:

| Category | Examples |
| --- | --- |
| Identity conflict | User email collision, existing place/offer/article match ambiguity. |
| Profile classification | Personal vs business profile ambiguity. |
| Taxonomy mapping | Source term with no approved target mapping. |
| Relation mapping | Unknown Voxel relation key or unsupported endpoint pair. |
| Review conversion | Source score/text/author cannot be safely converted. |
| Redirect conflict | Legacy URL maps to multiple possible targets. |
| Media conflict | Same source identity resolves to different content hash. |

Manual decisions must be stored durably in the future implementation so reruns do not ask the same question again.

### Quarantine Report

Quarantine report should include:

- Source identity.
- Source URL where available.
- Target domain.
- Lifecycle state at quarantine time.
- Reason code and human-readable reason.
- Severity.
- Blocking dependencies.
- Suggested resolution.
- Whether retry is possible.
- Whether record is excluded by approved policy rather than broken data.

Quarantine is not only for errors. Policy exclusions, such as past events and event images, should be visible as policy-skipped or policy-quarantined depending on whether they affect parent record completion.

## SEO and Redirect Planning

SEO and redirects are late-stage because final target URLs and slug histories must exist first.

The planner should handle:

- Native SEO fields on target entities: title, description, H1, canonical URL, OG fields, robots, JSON-LD override where supported.
- Slug history models for supported content domains.
- RankMath redirect rules from WordPress.
- `_wp_old_slug` legacy slugs.
- Canonical WordPress source URLs for migrated records.
- Redirects for excluded content where product policy requires a section fallback or 410/no-index strategy.

Redirect decisions should be explicit:

| Decision | Meaning |
| --- | --- |
| Redirect to migrated target | Source URL has a published target entity. |
| Redirect to canonical parent/section | Source content is excluded but a business-approved fallback exists. |
| Do not redirect | Source URL should not be preserved. |
| Manual review | Rule is ambiguous, conflicting, serialized in unsupported shape, or causes loop risk. |

RankMath rules should not be blindly copied. They need normalization, loop detection, priority handling, and conflict resolution against generated target redirects.

## Risks

| Risk | Mitigation |
| --- | --- |
| Overloading current import models | Use separate Phoenix ledger proposal and keep existing import workflow intact. |
| Duplicate target entities after crash | Require lineage and idempotency checks before every target write. |
| Dry-run and commit divergence | Use the same normalization, validation, and planning logic for both modes. |
| Event images accidentally migrate | Enforce event media exclusion in the media planner before fetch/copy. |
| Past events leak into v1 | Validate event eligibility before planning. |
| User password expectations | Do not migrate passwords; report reactivation-required users and align product flow. |
| Profile ambiguity | Quarantine ambiguous personal/business profiles for manual review. |
| Taxonomy drift | Require curated taxonomy mapping and report unmapped terms. |
| Media volume/cost | Plan first, dedup by lineage/hash, and import only approved scopes. |
| Relation ambiguity | Map known relation keys to native targets; quarantine unknown keys. |
| Redirect loops/conflicts | Normalize and validate redirects after target URLs are final. |
| Existing target data conflicts | Use lineage first, deterministic matching second, manual review third. |
| Adapter-specific assumptions leaking into core | Keep WordPress logic inside adapter and use normalized Phoenix domains in the engine. |

## Required Prisma Proposal

New Prisma models are required to make Phoenix lineage and idempotency reliable. This is a proposal only. No Prisma schema changes are made in Phase 2.

### Proposal Decision

Create separate Phoenix migration models rather than extending `ImportSource`, `ImportRun`, and `ImportedRecord`.

Suggested naming options:

| Option | Pros | Cons |
| --- | --- | --- |
| `Phoenix*` models | Clearly tied to Project Phoenix and avoids confusion with existing import feature. | Project codename may outlive usefulness. |
| `Migration*` models | Generic permanent naming that fits future adapters. | Slightly less distinct from existing import feature. |

Recommendation: use permanent `Migration*` model names in Prisma and reserve "Phoenix" as the project/initiative name.

### Proposed Models

| Model | Required purpose |
| --- | --- |
| `MigrationSource` | Configured source system with adapter key, source namespace, status, scope, and source metadata. |
| `MigrationRun` | One dry-run or commit execution with mode, adapter version, status, counters, snapshot hash, timestamps, and report links. |
| `MigrationRecord` | Per-source-record lifecycle, source identity, source hash, normalized payload reference, target plan summary, error/quarantine state, and checkpoint metadata. |
| `MigrationLineage` | Durable source-to-target mapping for idempotency across runs. Supports generic target entity type and target ID. |
| `MigrationMediaAsset` | Source media identity to target media asset mapping, approved scope, dedup hash, status, and binding metadata. |
| `MigrationRelation` | Source relation identity to native relation plan/result mapping. |
| `MigrationRedirect` | Source URL/rule to target redirect decision/result mapping. |
| `MigrationReviewTask` | Manual decisions required for ambiguous records, taxonomy mappings, relation mappings, media conflicts, and redirects. |
| `MigrationQuarantineItem` | Durable blocked-record reason with severity, lifecycle stage, retryability, and resolution state. |
| `MigrationReportArtifact` | Machine, human, manual-review, and quarantine report references. |

### Proposed Enums

| Enum | Values |
| --- | --- |
| `MigrationRunMode` | `DRY_RUN`, `COMMIT` |
| `MigrationRunStatus` | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`, `PARTIAL` |
| `MigrationRecordStatus` | `DISCOVERED`, `EXTRACTED`, `NORMALIZED`, `VALIDATED`, `PLANNED`, `PUBLISHED`, `LINKED`, `COMPLETED`, `QUARANTINED`, `FAILED` |
| `MigrationTargetType` | `USER`, `BUSINESS`, `PLACE`, `OFFER`, `ACTIVITY`, `ARTICLE`, `ROUTE`, `ROUTE_STOP`, `PLACE_REVIEW`, `MEDIA_ASSET`, `TAXONOMY`, `RELATION`, `REDIRECT`, plus future-safe extension policy. |
| `MigrationMediaScope` | `USER_PROFILE`, `BUSINESS_PROFILE`, `PLACE`, `ARTICLE`, `OFFER_SERVICES`, `OFFER_PROGRAMS`, `ROUTE`, `EVENT_BLOCKED` |
| `MigrationPlanAction` | `CREATE`, `UPDATE`, `LINK_EXISTING`, `SKIP_UNCHANGED`, `SKIP_POLICY`, `QUARANTINE`, `FAIL` |
| `MigrationReportType` | `MACHINE`, `HUMAN`, `MANUAL_REVIEW`, `QUARANTINE` |

### Required Uniqueness Constraints

Future schema should enforce:

| Constraint | Purpose |
| --- | --- |
| Unique source namespace + adapter key | Avoid accidental cross-source identity collisions. |
| Unique record identity per source | One logical record per adapter/source entity/stable source ID. |
| Unique lineage per source identity + target type + target role | Prevent duplicate target creation across reruns. |
| Unique media lineage per source media identity | Prevent duplicate media imports. |
| Unique content hash mapping where appropriate | Allow dedup reuse while avoiding false filename matches. |
| Unique relation identity per source relation | Prevent duplicate native links. |
| Unique redirect source path/mode per source | Prevent conflicting redirect output. |

### Raw Payload Storage Policy

The Prisma proposal should avoid forcing large raw payloads into database rows by default. Recommended policy:

- Store small structured payloads inline only when useful for review.
- Store large raw exports, HTML, serialized WordPress metadata, and media metadata as artifact references.
- Store stable hashes in the ledger so artifacts can be verified.
- Preserve enough normalized payload or plan summary to debug reports without loading the full export.

### Why New Models Are Unavoidable

Without new models, Phoenix cannot reliably provide:

- Generic lineage for all required target domains.
- One-source-to-many-target mappings.
- Media source attachment lineage and approved-scope filtering.
- Relation and redirect lineage.
- Durable lifecycle states matching the approved Phoenix pipeline.
- Resume/retry checkpoints across publishing, linking, media binding, and reports.
- Idempotency guarantees independent of existing content import assumptions.

## Open Questions Before Phase 3

1. Should Prisma names use `Migration*` as recommended, or should the project keep `Phoenix*` names for clarity during implementation?
2. What is the exact durable storage policy for raw payloads and reports: database JSON, local artifacts, object storage, or mixed?
3. What is the final user activation UX for migrated users, and what status should imported users have before reactivation?
4. How should duplicate WordPress user emails be handled if the target already has a mamaGo user?
5. How should `profile` posts be classified between user profile, business profile, organizer, place owner, and ignored/archived profile?
6. What is the authoritative cutoff rule for "past events" in Phoenix v1, including timezone and recurring/multi-session cases?
7. Which taxonomy mappings are curated before commit, and which can be created automatically?
8. Which WordPress pages, collections, products, specialists, and other custom post types are explicitly out of scope, redirected, archived, or mapped later?
9. What is the approved conversion from Voxel review score scale to mamaGo `PlaceReview.rating`?
10. Should RankMath redirects for excluded content redirect to section hubs, migrated parents, or no target?
11. Should existing `src/server/modules/import` UI/review components be reused by Phoenix, or should Phoenix have a separate admin workflow?
12. Which media storage backend and path policy should migrated media use in commit mode?
13. How should manual decisions be versioned so reruns remain reproducible after taxonomy or business rules change?
14. What is the minimum report set required before the first Phase 3 dry-run can be accepted?
