# Project Phoenix: Migration Ledger Schema Proposal

Phase 3: Minimal Prisma Schema Proposal

This document is a schema proposal only. It does not change `prisma/schema.prisma`, does not create a migration, does not run `prisma migrate dev`, does not write to the database, does not import WordPress data, does not modify existing import flows, and does not push changes.

Source documents:

- `docs/migration/wordpress-to-mamago.md`
- `docs/migration/migration-engine.md`
- Current `ImportSource` / `ImportRun` / `ImportedRecord` schema block in `prisma/schema.prisma`

## Executive Decision

The minimal permanent ledger for Phoenix v1 should use separate `Migration*` tables, not the existing `Import*` tables.

The current `Import*` schema is useful for the existing content import/review feature, but it is not sufficient for Phoenix because it is limited to `PLACE`, `EVENT`, and `OFFER`, links only to Place/Activity targets, and has no first-class media, relation, redirect, or generic lineage model.

Recommended v1 model set:

| Model | Keep in v1 | Reason |
| --- | --- | --- |
| `MigrationSource` | Yes | Required source namespace and adapter identity. |
| `MigrationRun` | Yes | Required dry-run/commit execution boundary and reporting boundary. |
| `MigrationRecord` | Yes | Required per-run record lifecycle and retry checkpoint. |
| `MigrationLineage` | Yes | Required idempotency anchor across runs. |
| `MigrationMediaAsset` | Yes | Required media source lineage, deduplication, approved-scope filtering, and target media mapping. |
| `MigrationRelation` | Yes | Required Voxel/source relation lineage and retryable linking. |
| `MigrationRedirect` | Yes | Required RankMath/source URL redirect lineage and conflict tracking. |
| `MigrationReviewTask` | Yes | Required durable manual decisions so reruns do not ask the same question again. |
| `MigrationQuarantineItem` | Yes | Required blocking state, policy exclusions, retryability, and audit. |
| `MigrationReportArtifact` | Yes | Required dry-run/commit reporting, machine diffing, and run audit. |

## Can v1 Be Smaller?

Short answer: not without losing one of the required guarantees.

| Candidate reduction | Technically possible | What is lost |
| --- | --- | --- |
| Merge `MigrationLineage` into `MigrationRecord` | No for permanent engine | Cross-run idempotency becomes fragile because records are run-scoped. A crash or new run would need to infer target identity from old run records. |
| Merge `MigrationMediaAsset` into `MigrationRecord.mediaRefs` JSON | Not recommended | Media deduplication, source attachment lineage, and repeated binding across entities become hard to query and retry. |
| Merge `MigrationRelation` into `MigrationRecord.relationRefs` JSON | Not recommended | Relations can only be linked after both endpoints exist; they need their own status and retry lifecycle. |
| Merge `MigrationRedirect` into `MigrationRecord.redirectRefs` JSON | Not recommended | RankMath redirects and legacy URLs can exist without a content record and need independent conflict/loop reporting. |
| Merge `MigrationReviewTask` and `MigrationQuarantineItem` | Possible but weak | Manual decisions and blocked records are different workflows. Review can resolve ambiguity; quarantine can be policy/data/operational block. |
| Remove `MigrationReportArtifact` and write files only | Possible for a one-off script | Dry-run/commit reports lose durable run association, hashes, and auditability in the application database. |

The only safe v1 compression is to avoid extra models that are not listed above:

- No separate `MigrationMediaBinding` in v1. Store binding plans/results in `MigrationMediaAsset.bindingPlan` and `MigrationMediaAsset.bindingResult`.
- No separate `MigrationTaxonomyMapping` in v1. Store taxonomy mapping decisions as `MigrationRecord` plans plus `MigrationReviewTask` decisions.
- No separate `MigrationFieldOverride` in v1. Reuse the idea later if Phoenix needs protected-field updates after initial migration.

This keeps the requested ten models and avoids overdesign beyond them.

## Design Principles

1. `MigrationRecord` is run-scoped; `MigrationLineage` is source-scoped and survives across runs.
2. `sourceRecordKey`, `sourceMediaKey`, `sourceRelationKey`, and `sourceRedirectKey` are deterministic idempotency keys produced by adapters.
3. Source entity types stay as `String` because adapters are open-ended.
4. Target entity types use an enum because target domains are native mamaGo domains.
5. Target links use `targetType` + `targetId` instead of Prisma relations to every target model. This keeps the proposal minimally invasive and avoids modifying `User`, `Place`, `Offer`, `Activity`, `Article`, `Route`, `MediaAsset`, and other existing models.
6. Raw payloads should usually be stored as artifact references, not large JSON blobs in database rows.
7. Dry-run can persist ledger/report artifacts in future implementation, but must not write target content tables.

## Proposed Enums

### `MigrationSourceStatus`

Purpose: lifecycle of a configured source.

Values:

| Value | Meaning |
| --- | --- |
| `ACTIVE` | Source can run. |
| `PAUSED` | Source is intentionally paused. |
| `DISABLED` | Source is disabled and should not run. |
| `ERROR` | Source has a configuration or adapter error. |
| `ARCHIVED` | Source is retained for audit only. |

### `MigrationRunMode`

Purpose: separates planning/reporting from target writes.

Values:

| Value | Meaning |
| --- | --- |
| `DRY_RUN` | Plan and report without target content writes. |
| `COMMIT` | Apply approved plans with idempotency. |

### `MigrationRunStatus`

Purpose: run-level state.

Values:

| Value | Meaning |
| --- | --- |
| `PENDING` | Run was created but not started. |
| `RUNNING` | Run is active. |
| `COMPLETED` | Run completed without unresolved failures. |
| `PARTIAL` | Run completed with quarantined or failed items. |
| `FAILED` | Run stopped due to an unrecovered error. |
| `CANCELLED` | Run was intentionally stopped. |

### `MigrationRecordStatus`

Purpose: approved Phoenix lifecycle for a source record.

Values:

| Value | Meaning |
| --- | --- |
| `DISCOVERED` | Stable source identity found. |
| `EXTRACTED` | Raw payload captured/referenced and hashed. |
| `NORMALIZED` | Source payload converted to normalized Phoenix shape. |
| `VALIDATED` | Automated validation passed or produced explicit review/quarantine output. |
| `PLANNED` | Deterministic entity/media/relation/redirect plan exists. |
| `PUBLISHED` | Primary target publication succeeded or was simulated in dry-run. |
| `LINKED` | Dependent links/media/relations/redirects were connected. |
| `COMPLETED` | Record finished or was intentionally skipped with durable state. |
| `QUARANTINED` | Record is blocked by policy, data, dependency, or manual review. |
| `FAILED` | Operational failure occurred and can be retried from checkpoint. |

### `MigrationTargetType`

Purpose: generic native target domain identifier for lineage and plans.

Values for v1:

| Value | Meaning |
| --- | --- |
| `USER` | `User` target. |
| `USER_PROFILE` | User profile fields or avatar binding on `User`. |
| `CHILD` | `Child` target created from profile/user data. |
| `BUSINESS` | `Business` target. |
| `BUSINESS_PROFILE` | Business profile fields, logo, cover, organizer context. |
| `ORGANIZER` | `Organizer` target. |
| `PLACE` | `Place` target. |
| `OFFER` | `Offer` target, including services and programs. |
| `ACTIVITY` | Event target in `Activity`; Phoenix v1 excludes past events and all event images. |
| `ARTICLE` | `Article` target. |
| `ROUTE` | `Route` target. |
| `ROUTE_STOP` | `RouteStop` target. |
| `PLACE_REVIEW` | `PlaceReview` target. |
| `MEDIA_ASSET` | `MediaAsset` target. |
| `TAXONOMY` | Native taxonomy/filter/discovery target. |
| `RELATION` | Native relation/link side effect. |
| `REDIRECT` | Redirect/SEO artifact or manifest rule. |

### `MigrationPlanAction`

Purpose: deterministic planned action for a record or plan item.

Values:

| Value | Meaning |
| --- | --- |
| `CREATE` | Create a new target. |
| `UPDATE` | Update an existing target proven by lineage or approved matching. |
| `LINK_EXISTING` | Link to an existing target without creating it. |
| `SKIP_UNCHANGED` | Source hash matches previously completed lineage. |
| `SKIP_POLICY` | Skipped because Phoenix v1 policy excludes it. |
| `QUARANTINE` | Block until resolved. |
| `FAIL` | Operational failure. |

### `MigrationPlanStatus`

Purpose: common lifecycle for media/relation/redirect plans.

Values:

| Value | Meaning |
| --- | --- |
| `PLANNED` | Plan exists but has not been applied. |
| `SKIPPED` | Plan intentionally skipped. |
| `DUPLICATE` | Existing lineage/asset/rule is reused. |
| `APPLIED` | Plan has been applied. |
| `BOUND` | Media asset has been bound to target entity. |
| `LINKED` | Relation has been linked. |
| `QUARANTINED` | Plan item is blocked. |
| `FAILED` | Plan item failed operationally. |

### `MigrationMediaScope`

Purpose: explicit approved media scope gate.

Values:

| Value | Meaning |
| --- | --- |
| `USER_PROFILE` | User profile media. |
| `BUSINESS_PROFILE` | Business profile media. |
| `PLACE` | Place media. |
| `ARTICLE` | Article media. |
| `OFFER_SERVICES` | Offer media from WordPress `services`. |
| `OFFER_PROGRAMS` | Offer media from WordPress `hb-programs`. |
| `ROUTE` | Route media. |
| `EVENT_BLOCKED` | Event media encountered and blocked by policy. |

### `MigrationReviewTaskStatus`

Purpose: manual decision workflow.

Values: `PENDING`, `IN_REVIEW`, `RESOLVED`, `CANCELLED`.

### `MigrationReviewDecision`

Purpose: durable human decision.

Values: `APPROVE`, `REJECT`, `LINK_EXISTING`, `SKIP`, `DEFER`, `NEEDS_MORE_DATA`.

### `MigrationQuarantineStatus`

Purpose: lifecycle of blocked items.

Values: `OPEN`, `RESOLVED`, `IGNORED`, `RETRYING`.

### `MigrationSeverity`

Purpose: reporting and prioritization.

Values: `INFO`, `WARNING`, `ERROR`, `BLOCKER`.

### `MigrationReportType`

Purpose: report artifact classification.

Values: `MACHINE`, `HUMAN`, `MANUAL_REVIEW`, `QUARANTINE`.

## Model Details

## `MigrationSource`

### Purpose

Represents one configured source system and source namespace. Examples:

- WordPress production export from July 2026.
- Google Places source for a city.
- CSV upload from a partner.
- Excel workbook from an operator.
- Partner API feed.

### Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `String` | Yes | `cuid()` primary key. |
| `adapterKey` | `String` | Yes | Stable adapter key, such as `wordpress`, `google_places`, `csv`, `excel`, `partner_api`. Keep as string for future adapter extensibility. |
| `sourceNamespace` | `String` | Yes | Stable namespace for this source instance/export/feed. |
| `name` | `String` | Yes | Human-readable source name. |
| `status` | `MigrationSourceStatus` | Yes | Defaults to `ACTIVE`. |
| `config` | `Json?` | No | Non-secret config only. Secrets should live outside this table. |
| `scope` | `Json?` | No | City, domain, date range, adapter scope, or migration subset. |
| `capabilities` | `Json?` | No | Adapter capability snapshot. |
| `notes` | `String?` | No | Operational notes. |
| `lastRunAt` | `DateTime?` | No | Last run start. |
| `lastSuccessAt` | `DateTime?` | No | Last successful run. |
| `lastErrorAt` | `DateTime?` | No | Last source-level error. |
| `lastErrorMessage` | `String?` | No | Source-level error summary. |
| `archivedAt` | `DateTime?` | No | Archive marker. |
| `createdAt` | `DateTime` | Yes | Default `now()`. |
| `updatedAt` | `DateTime` | Yes | `@updatedAt`. |

### Relations

| Relation | Direction |
| --- | --- |
| `runs` | One source has many `MigrationRun` rows. |
| `records` | One source has many `MigrationRecord` rows. |
| `lineage` | One source has many `MigrationLineage` rows. |
| `mediaAssets` | One source has many `MigrationMediaAsset` rows. |
| `relations` | One source has many `MigrationRelation` rows. |
| `redirects` | One source has many `MigrationRedirect` rows. |
| `reviewTasks` | One source has many `MigrationReviewTask` rows. |
| `quarantineItems` | One source has many `MigrationQuarantineItem` rows. |
| `reportArtifacts` | One source has many `MigrationReportArtifact` rows. |

### Indexes and Unique Constraints

| Constraint | Purpose |
| --- | --- |
| `@@unique([adapterKey, sourceNamespace])` | Prevent source identity collisions. |
| `@@index([adapterKey, status])` | Source dashboard/filtering. |
| `@@index([status])` | Operational queues. |
| `@@index([archivedAt])` | Archive filtering. |

### Lifecycle

`ACTIVE -> PAUSED -> ACTIVE`, `ACTIVE -> ERROR`, `ERROR -> ACTIVE`, any non-running source can become `ARCHIVED`.

### Problems Closed

- Separates Phoenix sources from existing `ImportSource`.
- Provides adapter-agnostic namespace for idempotency.
- Allows WordPress to be first adapter without becoming schema vocabulary.

## `MigrationRun`

### Purpose

Represents one execution attempt in dry-run or commit mode.

### Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `String` | Yes | `cuid()` primary key. |
| `sourceId` | `String` | Yes | FK to `MigrationSource`. |
| `mode` | `MigrationRunMode` | Yes | `DRY_RUN` or `COMMIT`. |
| `status` | `MigrationRunStatus` | Yes | Defaults to `PENDING`. |
| `adapterVersion` | `String` | Yes | Adapter behavior version for reproducibility. |
| `triggerType` | `String?` | No | Manual, scheduled, API, future automation; string keeps this minimal. |
| `triggerUserId` | `String?` | No | Optional user ID without Prisma relation to avoid touching `User`. |
| `resumedFromRunId` | `String?` | No | Optional run ID if this is a resume/retry run. |
| `snapshotHash` | `String?` | No | Hash of source snapshot/export when available. |
| `snapshotRef` | `String?` | No | Artifact reference to source snapshot. |
| `planHash` | `String?` | No | Hash of deterministic plan for dry-run/commit comparison. |
| `counters` | `Json?` | No | Flexible counters by domain/status/action. |
| `errorMessage` | `String?` | No | Run-level failure summary. |
| `startedAt` | `DateTime?` | No | Start timestamp. |
| `finishedAt` | `DateTime?` | No | Finish timestamp. |
| `createdAt` | `DateTime` | Yes | Default `now()`. |
| `updatedAt` | `DateTime` | Yes | `@updatedAt`. |

### Relations

| Relation | Direction |
| --- | --- |
| `source` | Run belongs to `MigrationSource`. |
| `records` | Run has many `MigrationRecord` rows. |
| `lineage` | Run can touch many `MigrationLineage` rows. |
| `mediaAssets` | Run can create/update many `MigrationMediaAsset` rows. |
| `relations` | Run can create/update many `MigrationRelation` rows. |
| `redirects` | Run can create/update many `MigrationRedirect` rows. |
| `reviewTasks` | Run can create/update many `MigrationReviewTask` rows. |
| `quarantineItems` | Run can create/update many `MigrationQuarantineItem` rows. |
| `reportArtifacts` | Run has many `MigrationReportArtifact` rows. |

### Indexes and Unique Constraints

| Constraint | Purpose |
| --- | --- |
| `@@index([sourceId, status])` | Resume and dashboard queries. |
| `@@index([sourceId, mode])` | Dry-run/commit history. |
| `@@index([status])` | Active run lookup. |
| `@@index([createdAt])` | Chronological reports. |
| `@@index([resumedFromRunId])` | Retry lineage. |

No unique constraint is required beyond primary key. Multiple dry-runs against the same snapshot are valid.

### Lifecycle

`PENDING -> RUNNING -> COMPLETED`, `PENDING/RUNNING -> CANCELLED`, `RUNNING -> PARTIAL`, `RUNNING -> FAILED`.

### Problems Closed

- Provides dry-run vs commit boundary.
- Keeps reports and counters tied to an execution.
- Supports resume/retry without confusing source identity with run identity.

## `MigrationRecord`

### Purpose

Represents one source record within one run and tracks the approved Phoenix lifecycle: discovered, extracted, normalized, validated, planned, published, linked, completed, quarantined, failed.

### Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `String` | Yes | `cuid()` primary key. |
| `sourceId` | `String` | Yes | FK to `MigrationSource`. |
| `runId` | `String` | Yes | FK to `MigrationRun`. |
| `status` | `MigrationRecordStatus` | Yes | Defaults to `DISCOVERED`. |
| `sourceEntityType` | `String` | Yes | Adapter-defined source type, such as `wp_user`, `wp_post:places`, `wp_attachment`. |
| `sourceExternalId` | `String?` | No | Native source ID when available. |
| `sourceStableKey` | `String` | Yes | Adapter-produced stable key. |
| `sourceRecordKey` | `String` | Yes | Deterministic idempotency key for this source record. |
| `sourceUrl` | `String?` | No | Original source URL. |
| `canonicalSourceUrl` | `String?` | No | Normalized URL for matching/redirects. |
| `sourceUpdatedAt` | `DateTime?` | No | Source-side updated timestamp. |
| `sourceHash` | `String?` | No | Hash after extraction. |
| `rawPayloadRef` | `String?` | No | Artifact reference for raw payload. |
| `rawPayload` | `Json?` | No | Small payloads only. |
| `normalizedPayloadRef` | `String?` | No | Artifact reference for normalized payload if large. |
| `normalizedPayload` | `Json?` | No | Normalized payload snapshot when small enough. |
| `targetTypeHint` | `MigrationTargetType?` | No | Expected target domain. |
| `planAction` | `MigrationPlanAction?` | No | Planned action. |
| `planSummary` | `Json?` | No | Deterministic plan summary, not full importer code. |
| `validationSummary` | `Json?` | No | Validation result, warnings, blocking reasons. |
| `dependencyRefs` | `Json?` | No | Source refs required before publish/link. |
| `mediaRefs` | `Json?` | No | Source media refs discovered in this record. |
| `relationRefs` | `Json?` | No | Source relation refs discovered in this record. |
| `redirectRefs` | `Json?` | No | Source redirect refs discovered in this record. |
| `attemptCount` | `Int` | Yes | Defaults to `0`. |
| `lastErrorCode` | `String?` | No | Structured error code. |
| `lastErrorMessage` | `String?` | No | Human-readable error. |
| `createdAt` | `DateTime` | Yes | Default `now()`. |
| `updatedAt` | `DateTime` | Yes | `@updatedAt`. |

### Relations

| Relation | Direction |
| --- | --- |
| `source` | Record belongs to `MigrationSource`. |
| `run` | Record belongs to `MigrationRun`. |
| `lineage` | Record can produce many `MigrationLineage` rows. |
| `mediaAssets` | Record can request many `MigrationMediaAsset` rows. |
| `relationsFrom` / `relationsTo` | Record can be relation endpoint. |
| `redirects` | Record can produce many redirects. |
| `reviewTasks` | Record can have many review tasks. |
| `quarantineItems` | Record can have many quarantine items. |

### Indexes and Unique Constraints

| Constraint | Purpose |
| --- | --- |
| `@@unique([runId, sourceRecordKey])` | Prevent duplicate records inside one run. |
| `@@index([sourceId, sourceRecordKey])` | Find record history across runs. |
| `@@index([runId, status])` | Resume and reporting. |
| `@@index([sourceId, sourceEntityType, status])` | Domain-specific queues. |
| `@@index([sourceHash])` | Detect unchanged records. |
| `@@index([canonicalSourceUrl])` | Redirect/URL matching. |
| `@@index([targetTypeHint, status])` | Target-domain reporting. |

### Lifecycle

Uses `MigrationRecordStatus` exactly as approved in Phase 2.

### Problems Closed

- Adds lifecycle states missing from `ImportedRecord`.
- Supports all Phoenix domains, not just place/event/offer.
- Provides run-scoped checkpoints for resume/retry.
- Keeps raw/normalized/plan/report state separate from target writes.

## `MigrationLineage`

### Purpose

Durable mapping from a source record identity to a native target identity. This is the core idempotency table.

### Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `String` | Yes | `cuid()` primary key. |
| `sourceId` | `String` | Yes | FK to `MigrationSource`. |
| `recordId` | `String?` | No | Latest or creating `MigrationRecord`. |
| `runId` | `String?` | No | Latest run that touched this lineage. |
| `sourceEntityType` | `String` | Yes | Adapter-defined source type. |
| `sourceExternalId` | `String?` | No | Native source ID. |
| `sourceStableKey` | `String` | Yes | Stable source key. |
| `sourceRecordKey` | `String` | Yes | Deterministic source record key. |
| `targetType` | `MigrationTargetType` | Yes | Native target domain. |
| `targetId` | `String?` | No | Native target ID after publication/linking. |
| `targetRole` | `String` | Yes | Defaults to `primary`; supports one source record producing multiple targets. |
| `targetNaturalKey` | `String?` | No | Optional slug/email/source-independent key used for conflict reports. |
| `lastSourceHash` | `String?` | No | Last committed or completed source hash. |
| `lastPlanAction` | `MigrationPlanAction?` | No | Last applied/planned action. |
| `isActive` | `Boolean` | Yes | Defaults to `true`. |
| `firstSeenAt` | `DateTime` | Yes | Default `now()`. |
| `lastSeenAt` | `DateTime?` | No | Updated when source record appears. |
| `lastImportedAt` | `DateTime?` | No | Updated when commit succeeds. |
| `createdAt` | `DateTime` | Yes | Default `now()`. |
| `updatedAt` | `DateTime` | Yes | `@updatedAt`. |

### Relations

| Relation | Direction |
| --- | --- |
| `source` | Lineage belongs to `MigrationSource`. |
| `record` | Optional latest/creating `MigrationRecord`. |
| `run` | Optional latest `MigrationRun`. |

Target models are referenced by generic `targetType` + `targetId`, not Prisma relations.

### Indexes and Unique Constraints

| Constraint | Purpose |
| --- | --- |
| `@@unique([sourceId, sourceRecordKey, targetType, targetRole])` | Primary idempotency guarantee. |
| `@@index([targetType, targetId])` | Find source lineage for target. |
| `@@index([sourceId, sourceEntityType])` | Source-domain lookup. |
| `@@index([sourceId, sourceExternalId])` | WordPress ID lookup. |
| `@@index([lastSourceHash])` | Unchanged detection. |
| `@@index([isActive])` | Active lineage filtering. |

### Lifecycle

Created during planning or publication. Updated when the same source record is seen again. `targetId` is null until a target exists or when a record is intentionally skipped but still needs source audit.

### Problems Closed

- Prevents duplicate targets across reruns.
- Supports one source record producing multiple target records.
- Lets resume skip target creation after a crash.
- Avoids adding legacy ID columns to every target table.

## `MigrationMediaAsset`

### Purpose

Tracks source media identity, approved scope filtering, deduplication, target `MediaAsset` mapping, and binding plan/result.

### Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `String` | Yes | `cuid()` primary key. |
| `sourceId` | `String` | Yes | FK to `MigrationSource`. |
| `runId` | `String?` | No | Run that planned/imported this media. |
| `recordId` | `String?` | No | Source record that requested the media. |
| `status` | `MigrationPlanStatus` | Yes | Defaults to `PLANNED`. |
| `sourceMediaKey` | `String` | Yes | Deterministic media idempotency key. |
| `sourceMediaExternalId` | `String?` | No | WordPress attachment ID or partner media ID. |
| `sourceUrl` | `String?` | No | Original URL. |
| `canonicalSourceUrl` | `String?` | No | Normalized media URL. |
| `sourcePath` | `String?` | No | Export/local source path. |
| `sourceHash` | `String?` | No | Source metadata hash. |
| `contentHash` | `String?` | No | Strong file hash when available. |
| `fileName` | `String?` | No | Original filename for audit only. |
| `mimeType` | `String?` | No | Media MIME type. |
| `byteSize` | `Int?` | No | File size. |
| `width` | `Int?` | No | Image width. |
| `height` | `Int?` | No | Image height. |
| `altText` | `String?` | No | Source alt text. |
| `primaryScope` | `MigrationMediaScope?` | No | Primary or first approved/blocked scope for filtering. |
| `requestedBindings` | `Json?` | No | All requested target bindings. |
| `approvedBindings` | `Json?` | No | Bindings allowed by Phoenix policy. |
| `blockedBindings` | `Json?` | No | Event/disallowed bindings, with reasons. |
| `targetMediaAssetId` | `String?` | No | Target `MediaAsset.id` after import or dedup. No Prisma relation required in v1. |
| `bindingPlan` | `Json?` | No | Planned entity bindings. |
| `bindingResult` | `Json?` | No | Applied binding results. |
| `lastErrorMessage` | `String?` | No | Operational failure summary. |
| `createdAt` | `DateTime` | Yes | Default `now()`. |
| `updatedAt` | `DateTime` | Yes | `@updatedAt`. |

### Relations

| Relation | Direction |
| --- | --- |
| `source` | Media asset belongs to `MigrationSource`. |
| `run` | Optional latest/creating `MigrationRun`. |
| `record` | Optional source `MigrationRecord`. |

Target media is referenced by `targetMediaAssetId` without Prisma relation to keep existing `MediaAsset` unchanged.

### Indexes and Unique Constraints

| Constraint | Purpose |
| --- | --- |
| `@@unique([sourceId, sourceMediaKey])` | Prevent duplicate media imports from the same source. |
| `@@index([runId, status])` | Media retry/reporting. |
| `@@index([recordId])` | Record-level media report. |
| `@@index([sourceMediaExternalId])` | WordPress attachment lookup. |
| `@@index([contentHash])` | Deduplication. |
| `@@index([targetMediaAssetId])` | Target media lookup. |
| `@@index([primaryScope, status])` | Policy/reporting by scope. |

### Lifecycle

`PLANNED -> DUPLICATE/APPLIED -> BOUND`, or `PLANNED -> SKIPPED` for policy skip, or `PLANNED -> QUARANTINED/FAILED`.

### Problems Closed

- Preserves WordPress attachment lineage.
- Allows approved-scope filtering before media writes.
- Blocks event media explicitly.
- Allows deduplication by source identity and content hash.
- Supports repeat binding without creating duplicate assets.

## `MigrationRelation`

### Purpose

Tracks source relations such as Voxel relation rows and converts them to native mamaGo links only after endpoints exist.

### Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `String` | Yes | `cuid()` primary key. |
| `sourceId` | `String` | Yes | FK to `MigrationSource`. |
| `runId` | `String?` | No | Run that planned/linked this relation. |
| `fromRecordId` | `String?` | No | Optional source endpoint record. |
| `toRecordId` | `String?` | No | Optional source endpoint record. |
| `status` | `MigrationPlanStatus` | Yes | Defaults to `PLANNED`. |
| `sourceRelationKey` | `String` | Yes | Deterministic relation idempotency key. |
| `sourceRelationType` | `String` | Yes | Adapter/source relation key, such as Voxel `relation_key`. |
| `sourceRelationExternalId` | `String?` | No | Source row ID when available. |
| `fromSourceRecordKey` | `String?` | No | Source key of relation origin. |
| `toSourceRecordKey` | `String?` | No | Source key of relation target. |
| `fromTargetType` | `MigrationTargetType?` | No | Resolved target type. |
| `fromTargetId` | `String?` | No | Resolved target ID. |
| `toTargetType` | `MigrationTargetType?` | No | Resolved target type. |
| `toTargetId` | `String?` | No | Resolved target ID. |
| `nativeRelationType` | `String?` | No | Planned mamaGo relation/action name. |
| `planSummary` | `Json?` | No | Native relation plan. |
| `applyResult` | `Json?` | No | Result after commit/linking. |
| `lastErrorMessage` | `String?` | No | Operational failure summary. |
| `createdAt` | `DateTime` | Yes | Default `now()`. |
| `updatedAt` | `DateTime` | Yes | `@updatedAt`. |

### Relations

| Relation | Direction |
| --- | --- |
| `source` | Relation belongs to `MigrationSource`. |
| `run` | Optional latest/creating `MigrationRun`. |
| `fromRecord` | Optional source endpoint record. |
| `toRecord` | Optional source endpoint record. |

Native target links are referenced generically because relations may target many different models.

### Indexes and Unique Constraints

| Constraint | Purpose |
| --- | --- |
| `@@unique([sourceId, sourceRelationKey])` | Prevent duplicate relation application. |
| `@@index([runId, status])` | Retry/reporting. |
| `@@index([sourceRelationType])` | Relation-key triage. |
| `@@index([fromSourceRecordKey])` | Endpoint resolution. |
| `@@index([toSourceRecordKey])` | Endpoint resolution. |
| `@@index([fromTargetType, fromTargetId])` | Target relation audit. |
| `@@index([toTargetType, toTargetId])` | Target relation audit. |

### Lifecycle

`PLANNED -> LINKED/APPLIED`, or `PLANNED -> QUARANTINED` when endpoint or mapping is missing, or `PLANNED -> FAILED` for operational errors.

### Problems Closed

- Keeps Voxel relations out of opaque JSON.
- Allows relation linking after target endpoints exist.
- Supports unknown relation keys through review/quarantine.
- Prevents duplicate relation creation on reruns.

## `MigrationRedirect`

### Purpose

Tracks source URLs, legacy slugs, RankMath redirect rows, and generated redirect decisions independently from content records.

### Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `String` | Yes | `cuid()` primary key. |
| `sourceId` | `String` | Yes | FK to `MigrationSource`. |
| `runId` | `String?` | No | Run that planned/generated this redirect. |
| `recordId` | `String?` | No | Optional content record that produced the redirect. |
| `status` | `MigrationPlanStatus` | Yes | Defaults to `PLANNED`. |
| `sourceRedirectKey` | `String` | Yes | Deterministic redirect idempotency key. |
| `sourceRedirectExternalId` | `String?` | No | RankMath row ID or equivalent. |
| `sourceUrl` | `String?` | No | Original source URL or rule. |
| `normalizedSourcePath` | `String` | Yes | Normalized path/rule key. |
| `matchMode` | `String` | Yes | Exact/start/contains/regex/etc. Adapter-defined string. |
| `sourceDestinationUrl` | `String?` | No | Source redirect destination if any. |
| `targetType` | `MigrationTargetType?` | No | Target domain if redirect points to migrated entity. |
| `targetId` | `String?` | No | Target entity ID if known. |
| `targetUrl` | `String?` | No | Final target URL/path. |
| `httpStatus` | `Int?` | No | Redirect status, usually 301/302. |
| `priority` | `Int` | Yes | Defaults to `0`. |
| `conflictGroupKey` | `String?` | No | Groups conflicting rules. |
| `planSummary` | `Json?` | No | Normalized rule and decision details. |
| `applyResult` | `Json?` | No | Manifest/build output after commit. |
| `lastErrorMessage` | `String?` | No | Operational failure summary. |
| `createdAt` | `DateTime` | Yes | Default `now()`. |
| `updatedAt` | `DateTime` | Yes | `@updatedAt`. |

### Relations

| Relation | Direction |
| --- | --- |
| `source` | Redirect belongs to `MigrationSource`. |
| `run` | Optional latest/creating `MigrationRun`. |
| `record` | Optional source `MigrationRecord`. |

### Indexes and Unique Constraints

| Constraint | Purpose |
| --- | --- |
| `@@unique([sourceId, sourceRedirectKey])` | Prevent duplicate redirect plan rows. |
| `@@index([runId, status])` | Retry/reporting. |
| `@@index([recordId])` | Content-derived redirect lookup. |
| `@@index([sourceId, normalizedSourcePath, matchMode])` | Conflict detection. |
| `@@index([targetType, targetId])` | Target redirect audit. |
| `@@index([conflictGroupKey])` | Manual review grouping. |

### Lifecycle

`PLANNED -> APPLIED`, `PLANNED -> SKIPPED`, `PLANNED -> QUARANTINED`, or `PLANNED -> FAILED`.

### Problems Closed

- Makes RankMath/source redirects first-class.
- Handles redirects for excluded content without requiring a migrated content record.
- Enables conflict and loop reporting before commit.
- Prevents duplicate redirect generation on reruns.

## `MigrationReviewTask`

### Purpose

Stores manual decisions that must survive reruns. Review is for ambiguity, not only failure.

### Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `String` | Yes | `cuid()` primary key. |
| `sourceId` | `String` | Yes | FK to `MigrationSource`. |
| `runId` | `String?` | No | Run that created/latest touched the task. |
| `recordId` | `String?` | No | Optional source record. |
| `status` | `MigrationReviewTaskStatus` | Yes | Defaults to `PENDING`. |
| `priority` | `Int` | Yes | Defaults to `0`. |
| `scopeKey` | `String` | Yes | Deterministic key for task subject, such as record/media/relation/redirect/taxonomy. |
| `reasonCode` | `String` | Yes | Structured reason. |
| `title` | `String` | Yes | Short task title. |
| `summary` | `String?` | No | Human-readable context. |
| `context` | `Json?` | No | Structured source/target details. |
| `proposedDecision` | `Json?` | No | Suggested action and alternatives. |
| `decision` | `MigrationReviewDecision?` | No | Final reviewer decision. |
| `decisionPayload` | `Json?` | No | Structured decision details. |
| `reviewerUserId` | `String?` | No | Optional user ID without Prisma relation. |
| `reviewedAt` | `DateTime?` | No | Decision timestamp. |
| `createdAt` | `DateTime` | Yes | Default `now()`. |
| `updatedAt` | `DateTime` | Yes | `@updatedAt`. |

### Relations

| Relation | Direction |
| --- | --- |
| `source` | Task belongs to `MigrationSource`. |
| `run` | Optional latest/creating `MigrationRun`. |
| `record` | Optional source `MigrationRecord`. |

### Indexes and Unique Constraints

| Constraint | Purpose |
| --- | --- |
| `@@unique([sourceId, scopeKey, reasonCode])` | Prevent asking the same question on every rerun. |
| `@@index([status, priority])` | Review queue. |
| `@@index([sourceId, status])` | Source-level review dashboard. |
| `@@index([runId, status])` | Run-level reporting. |
| `@@index([recordId])` | Record-level review lookup. |

### Lifecycle

`PENDING -> IN_REVIEW -> RESOLVED`, or `PENDING/IN_REVIEW -> CANCELLED`.

### Problems Closed

- Captures user/email conflicts, profile classification, taxonomy mapping, relation mapping, media conflicts, and redirect conflicts.
- Keeps manual decisions reusable across dry-run and commit.
- Avoids overloading quarantine with human workflow state.

## `MigrationQuarantineItem`

### Purpose

Stores blocking conditions, policy exclusions, and retryable failures for records, media, relations, redirects, and other migration subjects.

### Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `String` | Yes | `cuid()` primary key. |
| `sourceId` | `String` | Yes | FK to `MigrationSource`. |
| `runId` | `String?` | No | Run that created/latest touched the item. |
| `recordId` | `String?` | No | Optional source record. |
| `status` | `MigrationQuarantineStatus` | Yes | Defaults to `OPEN`. |
| `severity` | `MigrationSeverity` | Yes | Defaults to `ERROR`. |
| `quarantineKey` | `String` | Yes | Deterministic key for deduplication. |
| `relatedType` | `String` | Yes | `record`, `media`, `relation`, `redirect`, `taxonomy`, etc. |
| `relatedKey` | `String` | Yes | Source/plan key of blocked subject. |
| `lifecycleStatus` | `MigrationRecordStatus?` | No | Record status when quarantined. |
| `reasonCode` | `String` | Yes | Structured block reason. |
| `reason` | `String` | Yes | Human-readable reason. |
| `blockingDependencies` | `Json?` | No | Missing users/places/taxonomies/media/etc. |
| `suggestedResolution` | `String?` | No | Human-facing next step. |
| `retryable` | `Boolean` | Yes | Defaults to `false`. |
| `resolvedByUserId` | `String?` | No | Optional user ID without Prisma relation. |
| `resolvedAt` | `DateTime?` | No | Resolution timestamp. |
| `resolutionNotes` | `String?` | No | Resolution details. |
| `createdAt` | `DateTime` | Yes | Default `now()`. |
| `updatedAt` | `DateTime` | Yes | `@updatedAt`. |

### Relations

| Relation | Direction |
| --- | --- |
| `source` | Quarantine item belongs to `MigrationSource`. |
| `run` | Optional latest/creating `MigrationRun`. |
| `record` | Optional source `MigrationRecord`. |

### Indexes and Unique Constraints

| Constraint | Purpose |
| --- | --- |
| `@@unique([sourceId, quarantineKey])` | Prevent duplicate quarantine items across reruns. |
| `@@index([runId, status])` | Run-level quarantine report. |
| `@@index([sourceId, status])` | Source-level queue. |
| `@@index([severity, status])` | Prioritized handling. |
| `@@index([recordId])` | Record-level diagnosis. |
| `@@index([relatedType, relatedKey])` | Media/relation/redirect diagnosis. |

### Lifecycle

`OPEN -> RETRYING -> RESOLVED`, `OPEN -> IGNORED`, or `RETRYING -> OPEN` if the retry still fails.

### Problems Closed

- Captures policy blocks such as event images and past events.
- Captures missing dependencies and validation failures.
- Makes retryability explicit.
- Separates blocked state from manual-review decisions.

## `MigrationReportArtifact`

### Purpose

Stores report artifact metadata for machine, human, manual-review, and quarantine reports.

### Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `String` | Yes | `cuid()` primary key. |
| `sourceId` | `String` | Yes | FK to `MigrationSource`. |
| `runId` | `String` | Yes | FK to `MigrationRun`. |
| `type` | `MigrationReportType` | Yes | Machine/human/manual-review/quarantine. |
| `format` | `String` | Yes | `json`, `ndjson`, `md`, `csv`, etc. |
| `artifactRef` | `String` | Yes | Path/object key/reference. |
| `artifactHash` | `String?` | No | Hash for reproducibility. |
| `byteSize` | `Int?` | No | Artifact size. |
| `summary` | `Json?` | No | Small counter summary for dashboards. |
| `generatedAt` | `DateTime` | Yes | Default `now()`. |
| `createdAt` | `DateTime` | Yes | Default `now()`. |
| `updatedAt` | `DateTime` | Yes | `@updatedAt`. |

### Relations

| Relation | Direction |
| --- | --- |
| `source` | Report belongs to `MigrationSource`. |
| `run` | Report belongs to `MigrationRun`. |

### Indexes and Unique Constraints

| Constraint | Purpose |
| --- | --- |
| `@@unique([runId, type, format])` | One canonical artifact per run/type/format. |
| `@@index([sourceId, type])` | Source-level reporting. |
| `@@index([runId])` | Run report lookup. |
| `@@index([artifactHash])` | Artifact verification/dedup. |

### Lifecycle

Generated during or after run completion. Can be replaced by updating the same `runId + type + format` row.

### Problems Closed

- Makes dry-run output durable and comparable to commit output.
- Preserves report hashes and artifact locations.
- Supports audit after WordPress retirement.

## Prisma Diff Proposal

This is a proposal block only. It is not applied to `prisma/schema.prisma`.

```diff
+enum MigrationSourceStatus {
+  ACTIVE
+  PAUSED
+  DISABLED
+  ERROR
+  ARCHIVED
+}
+
+enum MigrationRunMode {
+  DRY_RUN
+  COMMIT
+}
+
+enum MigrationRunStatus {
+  PENDING
+  RUNNING
+  COMPLETED
+  PARTIAL
+  FAILED
+  CANCELLED
+}
+
+enum MigrationRecordStatus {
+  DISCOVERED
+  EXTRACTED
+  NORMALIZED
+  VALIDATED
+  PLANNED
+  PUBLISHED
+  LINKED
+  COMPLETED
+  QUARANTINED
+  FAILED
+}
+
+enum MigrationTargetType {
+  USER
+  USER_PROFILE
+  CHILD
+  BUSINESS
+  BUSINESS_PROFILE
+  ORGANIZER
+  PLACE
+  OFFER
+  ACTIVITY
+  ARTICLE
+  ROUTE
+  ROUTE_STOP
+  PLACE_REVIEW
+  MEDIA_ASSET
+  TAXONOMY
+  RELATION
+  REDIRECT
+}
+
+enum MigrationPlanAction {
+  CREATE
+  UPDATE
+  LINK_EXISTING
+  SKIP_UNCHANGED
+  SKIP_POLICY
+  QUARANTINE
+  FAIL
+}
+
+enum MigrationPlanStatus {
+  PLANNED
+  SKIPPED
+  DUPLICATE
+  APPLIED
+  BOUND
+  LINKED
+  QUARANTINED
+  FAILED
+}
+
+enum MigrationMediaScope {
+  USER_PROFILE
+  BUSINESS_PROFILE
+  PLACE
+  ARTICLE
+  OFFER_SERVICES
+  OFFER_PROGRAMS
+  ROUTE
+  EVENT_BLOCKED
+}
+
+enum MigrationReviewTaskStatus {
+  PENDING
+  IN_REVIEW
+  RESOLVED
+  CANCELLED
+}
+
+enum MigrationReviewDecision {
+  APPROVE
+  REJECT
+  LINK_EXISTING
+  SKIP
+  DEFER
+  NEEDS_MORE_DATA
+}
+
+enum MigrationQuarantineStatus {
+  OPEN
+  RESOLVED
+  IGNORED
+  RETRYING
+}
+
+enum MigrationSeverity {
+  INFO
+  WARNING
+  ERROR
+  BLOCKER
+}
+
+enum MigrationReportType {
+  MACHINE
+  HUMAN
+  MANUAL_REVIEW
+  QUARANTINE
+}
+
+model MigrationSource {
+  id               String                @id @default(cuid())
+  adapterKey       String
+  sourceNamespace  String
+  name             String
+  status           MigrationSourceStatus @default(ACTIVE)
+  config           Json?
+  scope            Json?
+  capabilities     Json?
+  notes            String?
+  lastRunAt        DateTime?
+  lastSuccessAt    DateTime?
+  lastErrorAt      DateTime?
+  lastErrorMessage String?
+  archivedAt       DateTime?
+  createdAt        DateTime              @default(now())
+  updatedAt        DateTime              @updatedAt
+
+  runs            MigrationRun[]
+  records         MigrationRecord[]
+  lineage         MigrationLineage[]
+  mediaAssets     MigrationMediaAsset[]
+  relations       MigrationRelation[]
+  redirects       MigrationRedirect[]
+  reviewTasks     MigrationReviewTask[]
+  quarantineItems MigrationQuarantineItem[]
+  reportArtifacts MigrationReportArtifact[]
+
+  @@unique([adapterKey, sourceNamespace])
+  @@index([adapterKey, status])
+  @@index([status])
+  @@index([archivedAt])
+}
+
+model MigrationRun {
+  id               String             @id @default(cuid())
+  sourceId         String
+  mode             MigrationRunMode
+  status           MigrationRunStatus @default(PENDING)
+  adapterVersion   String
+  triggerType      String?
+  triggerUserId    String?
+  resumedFromRunId String?
+  snapshotHash     String?
+  snapshotRef      String?
+  planHash         String?
+  counters         Json?
+  errorMessage     String?
+  startedAt        DateTime?
+  finishedAt       DateTime?
+  createdAt        DateTime           @default(now())
+  updatedAt        DateTime           @updatedAt
+
+  source          MigrationSource @relation(fields: [sourceId], references: [id], onDelete: Cascade)
+  records         MigrationRecord[]
+  lineage         MigrationLineage[]
+  mediaAssets     MigrationMediaAsset[]
+  relations       MigrationRelation[]
+  redirects       MigrationRedirect[]
+  reviewTasks     MigrationReviewTask[]
+  quarantineItems MigrationQuarantineItem[]
+  reportArtifacts MigrationReportArtifact[]
+
+  @@index([sourceId, status])
+  @@index([sourceId, mode])
+  @@index([status])
+  @@index([createdAt])
+  @@index([resumedFromRunId])
+}
+
+model MigrationRecord {
+  id                   String                 @id @default(cuid())
+  sourceId             String
+  runId                String
+  status               MigrationRecordStatus  @default(DISCOVERED)
+  sourceEntityType     String
+  sourceExternalId     String?
+  sourceStableKey      String
+  sourceRecordKey      String
+  sourceUrl            String?
+  canonicalSourceUrl   String?
+  sourceUpdatedAt      DateTime?
+  sourceHash           String?
+  rawPayloadRef        String?
+  rawPayload           Json?
+  normalizedPayloadRef String?
+  normalizedPayload    Json?
+  targetTypeHint       MigrationTargetType?
+  planAction           MigrationPlanAction?
+  planSummary          Json?
+  validationSummary    Json?
+  dependencyRefs       Json?
+  mediaRefs            Json?
+  relationRefs         Json?
+  redirectRefs         Json?
+  attemptCount         Int                    @default(0)
+  lastErrorCode        String?
+  lastErrorMessage     String?
+  createdAt            DateTime               @default(now())
+  updatedAt            DateTime               @updatedAt
+
+  source          MigrationSource @relation(fields: [sourceId], references: [id], onDelete: Cascade)
+  run             MigrationRun    @relation(fields: [runId], references: [id], onDelete: Cascade)
+  lineage         MigrationLineage[]
+  mediaAssets     MigrationMediaAsset[]
+  relationsFrom   MigrationRelation[] @relation("MigrationRelationFromRecord")
+  relationsTo     MigrationRelation[] @relation("MigrationRelationToRecord")
+  redirects       MigrationRedirect[]
+  reviewTasks     MigrationReviewTask[]
+  quarantineItems MigrationQuarantineItem[]
+
+  @@unique([runId, sourceRecordKey])
+  @@index([sourceId, sourceRecordKey])
+  @@index([runId, status])
+  @@index([sourceId, sourceEntityType, status])
+  @@index([sourceHash])
+  @@index([canonicalSourceUrl])
+  @@index([targetTypeHint, status])
+}
+
+model MigrationLineage {
+  id               String               @id @default(cuid())
+  sourceId         String
+  recordId         String?
+  runId            String?
+  sourceEntityType String
+  sourceExternalId String?
+  sourceStableKey  String
+  sourceRecordKey  String
+  targetType       MigrationTargetType
+  targetId         String?
+  targetRole       String               @default("primary")
+  targetNaturalKey String?
+  lastSourceHash   String?
+  lastPlanAction   MigrationPlanAction?
+  isActive         Boolean              @default(true)
+  firstSeenAt      DateTime             @default(now())
+  lastSeenAt       DateTime?
+  lastImportedAt   DateTime?
+  createdAt        DateTime             @default(now())
+  updatedAt        DateTime             @updatedAt
+
+  source MigrationSource  @relation(fields: [sourceId], references: [id], onDelete: Cascade)
+  record MigrationRecord? @relation(fields: [recordId], references: [id])
+  run    MigrationRun?    @relation(fields: [runId], references: [id])
+
+  @@unique([sourceId, sourceRecordKey, targetType, targetRole])
+  @@index([targetType, targetId])
+  @@index([sourceId, sourceEntityType])
+  @@index([sourceId, sourceExternalId])
+  @@index([lastSourceHash])
+  @@index([isActive])
+}
+
+model MigrationMediaAsset {
+  id                    String               @id @default(cuid())
+  sourceId              String
+  runId                 String?
+  recordId              String?
+  status                MigrationPlanStatus  @default(PLANNED)
+  sourceMediaKey        String
+  sourceMediaExternalId String?
+  sourceUrl             String?
+  canonicalSourceUrl    String?
+  sourcePath            String?
+  sourceHash            String?
+  contentHash           String?
+  fileName              String?
+  mimeType              String?
+  byteSize              Int?
+  width                 Int?
+  height                Int?
+  altText               String?
+  primaryScope          MigrationMediaScope?
+  requestedBindings     Json?
+  approvedBindings      Json?
+  blockedBindings       Json?
+  targetMediaAssetId    String?
+  bindingPlan           Json?
+  bindingResult         Json?
+  lastErrorMessage      String?
+  createdAt             DateTime             @default(now())
+  updatedAt             DateTime             @updatedAt
+
+  source MigrationSource  @relation(fields: [sourceId], references: [id], onDelete: Cascade)
+  run    MigrationRun?    @relation(fields: [runId], references: [id])
+  record MigrationRecord? @relation(fields: [recordId], references: [id])
+
+  @@unique([sourceId, sourceMediaKey])
+  @@index([runId, status])
+  @@index([recordId])
+  @@index([sourceMediaExternalId])
+  @@index([contentHash])
+  @@index([targetMediaAssetId])
+  @@index([primaryScope, status])
+}
+
+model MigrationRelation {
+  id                       String               @id @default(cuid())
+  sourceId                 String
+  runId                    String?
+  fromRecordId             String?
+  toRecordId               String?
+  status                   MigrationPlanStatus  @default(PLANNED)
+  sourceRelationKey        String
+  sourceRelationType       String
+  sourceRelationExternalId String?
+  fromSourceRecordKey      String?
+  toSourceRecordKey        String?
+  fromTargetType           MigrationTargetType?
+  fromTargetId             String?
+  toTargetType             MigrationTargetType?
+  toTargetId               String?
+  nativeRelationType       String?
+  planSummary              Json?
+  applyResult              Json?
+  lastErrorMessage         String?
+  createdAt                DateTime             @default(now())
+  updatedAt                DateTime             @updatedAt
+
+  source     MigrationSource  @relation(fields: [sourceId], references: [id], onDelete: Cascade)
+  run        MigrationRun?    @relation(fields: [runId], references: [id])
+  fromRecord MigrationRecord? @relation("MigrationRelationFromRecord", fields: [fromRecordId], references: [id])
+  toRecord   MigrationRecord? @relation("MigrationRelationToRecord", fields: [toRecordId], references: [id])
+
+  @@unique([sourceId, sourceRelationKey])
+  @@index([runId, status])
+  @@index([sourceRelationType])
+  @@index([fromSourceRecordKey])
+  @@index([toSourceRecordKey])
+  @@index([fromTargetType, fromTargetId])
+  @@index([toTargetType, toTargetId])
+}
+
+model MigrationRedirect {
+  id                       String               @id @default(cuid())
+  sourceId                 String
+  runId                    String?
+  recordId                 String?
+  status                   MigrationPlanStatus  @default(PLANNED)
+  sourceRedirectKey        String
+  sourceRedirectExternalId String?
+  sourceUrl                String?
+  normalizedSourcePath     String
+  matchMode                String
+  sourceDestinationUrl     String?
+  targetType               MigrationTargetType?
+  targetId                 String?
+  targetUrl                String?
+  httpStatus               Int?
+  priority                 Int                  @default(0)
+  conflictGroupKey         String?
+  planSummary              Json?
+  applyResult              Json?
+  lastErrorMessage         String?
+  createdAt                DateTime             @default(now())
+  updatedAt                DateTime             @updatedAt
+
+  source MigrationSource  @relation(fields: [sourceId], references: [id], onDelete: Cascade)
+  run    MigrationRun?    @relation(fields: [runId], references: [id])
+  record MigrationRecord? @relation(fields: [recordId], references: [id])
+
+  @@unique([sourceId, sourceRedirectKey])
+  @@index([runId, status])
+  @@index([recordId])
+  @@index([sourceId, normalizedSourcePath, matchMode])
+  @@index([targetType, targetId])
+  @@index([conflictGroupKey])
+}
+
+model MigrationReviewTask {
+  id               String                    @id @default(cuid())
+  sourceId         String
+  runId            String?
+  recordId         String?
+  status           MigrationReviewTaskStatus @default(PENDING)
+  priority         Int                       @default(0)
+  scopeKey         String
+  reasonCode       String
+  title            String
+  summary          String?
+  context          Json?
+  proposedDecision Json?
+  decision         MigrationReviewDecision?
+  decisionPayload  Json?
+  reviewerUserId   String?
+  reviewedAt       DateTime?
+  createdAt        DateTime                  @default(now())
+  updatedAt        DateTime                  @updatedAt
+
+  source MigrationSource  @relation(fields: [sourceId], references: [id], onDelete: Cascade)
+  run    MigrationRun?    @relation(fields: [runId], references: [id])
+  record MigrationRecord? @relation(fields: [recordId], references: [id])
+
+  @@unique([sourceId, scopeKey, reasonCode])
+  @@index([status, priority])
+  @@index([sourceId, status])
+  @@index([runId, status])
+  @@index([recordId])
+}
+
+model MigrationQuarantineItem {
+  id                   String                    @id @default(cuid())
+  sourceId             String
+  runId                String?
+  recordId             String?
+  status               MigrationQuarantineStatus @default(OPEN)
+  severity             MigrationSeverity         @default(ERROR)
+  quarantineKey        String
+  relatedType          String
+  relatedKey           String
+  lifecycleStatus      MigrationRecordStatus?
+  reasonCode           String
+  reason               String
+  blockingDependencies Json?
+  suggestedResolution  String?
+  retryable            Boolean                   @default(false)
+  resolvedByUserId     String?
+  resolvedAt           DateTime?
+  resolutionNotes      String?
+  createdAt            DateTime                  @default(now())
+  updatedAt            DateTime                  @updatedAt
+
+  source MigrationSource  @relation(fields: [sourceId], references: [id], onDelete: Cascade)
+  run    MigrationRun?    @relation(fields: [runId], references: [id])
+  record MigrationRecord? @relation(fields: [recordId], references: [id])
+
+  @@unique([sourceId, quarantineKey])
+  @@index([runId, status])
+  @@index([sourceId, status])
+  @@index([severity, status])
+  @@index([recordId])
+  @@index([relatedType, relatedKey])
+}
+
+model MigrationReportArtifact {
+  id           String              @id @default(cuid())
+  sourceId     String
+  runId        String
+  type         MigrationReportType
+  format       String
+  artifactRef  String
+  artifactHash String?
+  byteSize     Int?
+  summary      Json?
+  generatedAt  DateTime            @default(now())
+  createdAt    DateTime            @default(now())
+  updatedAt    DateTime            @updatedAt
+
+  source MigrationSource @relation(fields: [sourceId], references: [id], onDelete: Cascade)
+  run    MigrationRun    @relation(fields: [runId], references: [id], onDelete: Cascade)
+
+  @@unique([runId, type, format])
+  @@index([sourceId, type])
+  @@index([runId])
+  @@index([artifactHash])
+}
```

## Impact on Current Code

### No Required Changes to Existing Import Flows

The proposal does not require modifying:

- `ImportSource`
- `ImportRun`
- `ImportedRecord`
- `ImportReviewTask`
- `ImportFieldOverride`
- Existing import/review services under the current import module

Phoenix can be implemented as a separate module later, for example under a future migration namespace, while existing import flows keep their current schema and behavior.

### Prisma Client Impact After Approval

After this schema is approved and applied in a future phase:

- Prisma Client will expose new `migrationSource`, `migrationRun`, `migrationRecord`, and related delegates.
- Existing delegates for `importSource`, `importRun`, and `importedRecord` remain unchanged.
- No existing target model needs a new legacy ID column.
- No existing target model needs a back-relation in v1 because target links are generic IDs.
- Future implementation will need a small type-safe mapper from `MigrationTargetType` + `targetId` to native repository calls.

### Operational Impact

The future migration will create new tables and enum types only. It should not alter existing content tables. This limits deployment risk and keeps Phoenix operational data separate from user-facing content.

## Future Migration Plan, Not Applied

This is a proposed future plan after explicit approval:

1. Confirm final model and enum names.
2. Add the proposed enums and models to `prisma/schema.prisma` in a dedicated "Migration Engine" section.
3. Run Prisma schema validation only after approval.
4. Generate a SQL migration draft using the team's approved non-mutating migration-generation process.
5. Review generated SQL for enum/table/index names and cascade behavior.
6. Apply migration only in an approved deployment phase.
7. Generate Prisma Client after schema approval.
8. Implement Phoenix repositories and adapter contracts against the new models.

Explicitly not part of this Phase 3 task:

- Do not run `prisma migrate dev`.
- Do not apply migrations.
- Do not write to any database.
- Do not import WordPress data.
- Do not modify existing import flows.
- Do not push.

## Open Questions Before Schema Approval

1. Should `MigrationTargetType` be an enum as proposed, or a string with a code-level allow-list to avoid future migrations when target domains expand?
2. Should `triggerUserId`, `reviewerUserId`, and `resolvedByUserId` remain plain strings, or should they become Prisma relations to `User` with back-relations?
3. Should `targetMediaAssetId` remain a plain string, or should it become a Prisma relation to `MediaAsset` with a back-relation?
4. Should dry-run persist full `MigrationRecord` rows, or should dry-run store only reports until commit is approved?
5. Should `MigrationMediaAsset` stay as asset plus binding-plan model, or should a separate `MigrationMediaBinding` be introduced before implementation?
6. Should quarantine dedupe key include `sourceHash` by convention, allowing the same record to be quarantined again after source data changes?
7. What artifact backend should be used for `rawPayloadRef`, `normalizedPayloadRef`, `snapshotRef`, and `artifactRef`?
8. Should future migration SQL use database-level partial unique indexes for open review/quarantine items, even though Prisma schema cannot express them cleanly?
