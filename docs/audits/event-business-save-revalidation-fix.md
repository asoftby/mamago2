# Event Business-Save Revalidation Fix

Date: 2026-05-19
Scope: `src/app/api/business/events/[id]/route.ts`
Follows: Phase 6B (`docs/audits/event-patch-hot-path-fix.md`)

## Business list components audited

| Component | Path |
|---|---|
| Business events list page | `src/app/business/(protected)/events/page.tsx` |
| Publications events list page | `src/app/business/(protected)/publications/events/page.tsx` |
| Event list container | `src/components/business/events/EventsList.tsx` |
| Event list card | `src/components/business/events/EventCardHorizontal.tsx` |
| Publication card wrapper | `src/components/business/shared/BusinessPublicationCard.tsx` |

Both list pages use `EventsList` → `EventCardHorizontal`. The card is shared between them.

## Fields visible in list cards

From `EventCardHorizontal.tsx` — what `buildEventSubtitle()` and the card render:

| Field | Shown as | Source |
|---|---|---|
| `title` | Card title | `activity.title` |
| `images[0]?.url` | Cover avatar | `activity.images` relation, first by `sortOrder` |
| `place?.title` | Subtitle part 1 | `activity.place.title` (via `placeId` FK) |
| `nextOccurrenceAt` | Subtitle part 2 | `activity.nextOccurrenceAt` |
| `priceText` | Subtitle part 3 | `activity.priceText` |
| `priceFrom` | Subtitle part 3 fallback | `activity.priceFrom` |
| `shortDesc` | Subtitle fallback | `activity.shortDesc` (when venue+date+price all absent) |
| `status` | Status pill | `activity.status` (only changes on submit/moderation, not draft PATCH) |
| `updatedAt` | Relative timestamp | auto-updated on any Prisma write |

## Fields classified as editor-only (not shown in list cards)

Changes to these fields in a normal draft PATCH can safely skip business list revalidation:

- `ageTags` — not rendered in list
- `scheduleMode` — not rendered in list
- `eventCategoryId` — not rendered in list
- `programCategoryLinks` — category not rendered in list
- `priceTo` — not rendered (only `priceFrom` shown)
- `currency` — not rendered
- `format` — not rendered
- `occasionLinks` — not rendered
- `organizerId` — not rendered
- `businessId` — not rendered
- `scheduleJson` metadata when session fingerprint is unchanged — `nextOccurrenceAt` won't change

## Implementation

### Two-layer guard

Revalidation is skipped only when all three conditions hold simultaneously:

```typescript
const canSkipBusinessListRevalidation =
  revalidateScope === "business-save" &&   // 1. draft scope only
  !listVisibleFieldChanged &&              // 2. no known list-visible field changed
  allChangedFieldsAreEditorOnly;           // 3. all changed fields are in explicit allowlist
```

**Layer 1 — `listVisibleFieldChanged`**: checks known list-visible Activity fields and side-effect flags:

```typescript
const listVisibleFieldChanged =
  "title" in updateData ||
  "shortDesc" in updateData ||    // set whenever title or description changes
  "priceFrom" in updateData ||
  "priceText" in updateData ||
  "coverImageId" in updateData ||
  "coverImageUrl" in updateData ||
  activitySessionsNeedResync ||   // nextOccurrenceAt will change
  galleryTouched ||               // images[0] may change
  venueSynced;                    // place.title may change
```

**Layer 2 — `allChangedFieldsAreEditorOnly`**: explicit allowlist for unknown-field fail-safe:

```typescript
const EDITOR_ONLY_ACTIVITY_FIELDS = new Set<string>([
  "description",          // always paired with shortDesc (list-visible); caught by layer 1
  "format",
  "ageTags",
  "scheduleMode",
  "scheduleJson",         // activitySessionsNeedResync handles the date/time path; caught by layer 1
  "eventCategoryId",
  "programCategoryLinks",
  "priceTo",
  "currency",
  "organizerId",
  "businessId",
]);

const changedActivityKeys = Object.keys(updateData);
const allChangedFieldsAreEditorOnly =
  changedActivityKeys.length === 0 ||   // side-effects only (sessions/gallery/occasions), no Activity writes
  changedActivityKeys.every((key) => EDITOR_ONLY_ACTIVITY_FIELDS.has(key));
```

**Unknown field behaviour**: if a new field is added to `updateData` in the future and is NOT in `EDITOR_ONLY_ACTIVITY_FIELDS`, `every()` returns `false` → `allChangedFieldsAreEditorOnly = false` → `canSkipBusinessListRevalidation = false` → revalidation runs. The developer must explicitly add it to the allowlist to opt out.

**`changedActivityKeys.length === 0` case**: covers occasion-only saves (`occasionsTouched = true`, `hasPrismaWrites = false`). List-visible impact of occasion changes is already `false` (occasions not shown in list cards). Layer 1 flags (`activitySessionsNeedResync`, `galleryTouched`, `venueSynced`) cover any real side-effect that affects the list.

## Where revalidation is now skipped

PATCH saves where `revalidateScope === "business-save"` AND all of these are true:
- No `title`, `shortDesc`, `priceFrom`, `priceText`, `coverImageId`, `coverImageUrl` in updateData
- `activitySessionsNeedResync = false` (no date/time change)
- `galleryTouched = false` (gallery unchanged)
- `venueSynced = false` (venue/place unchanged)
- All updateData keys are in the explicit editor-only allowlist

Example saves that skip business list revalidation:
- changing only `ageTags`
- changing only `eventCategoryId`
- changing only `occasionIds` (side-effect only, no Activity write)
- changing only `priceTo` or `currency`
- changing only `format` or `scheduleMode`
- changing `scheduleJson` metadata without altering session dates/times
- changing `organizerInput`
- changing `programCategoryIds`

## Where revalidation is intentionally kept

- Any PATCH that changes `title`, `description` (→ `shortDesc`), `priceFrom`, `priceText`, `coverImageId`, `coverImageUrl`
- Any PATCH where `activitySessionsNeedResync = true` (dates/times changed → `nextOccurrenceAt` updates)
- Any PATCH where `galleryTouched = true` (images[0] may change)
- Any PATCH where `venueSynced = true` (place.title may change)
- Any PATCH that adds an unknown field to `updateData` not in the allowlist
- All non-`"business-save"` scopes: `published-content-save`, `publish`, `moderation-status-change`, `visibility-change`, `slug-change`, `city-change`

## Fail-safe rule

**Two conditions must both pass** to skip revalidation:
1. Positive: `listVisibleFieldChanged === false` (no known list-visible change)
2. Negative: `allChangedFieldsAreEditorOnly === true` (no unknown fields leaked in)

If either fails, revalidation runs. An unknown field in `updateData` fails condition 2 automatically.

## Risks

- If `shortDesc` is ever computed from additional fields beyond `title`/`description`, `listVisibleFieldChanged` still catches it because `shortDesc` is always in `updateData` when recomputed.
- If a future code path writes to the gallery relation without setting `galleryTouched = true`, layer 1 would miss it. Mitigation: `galleryTouched` is set in the only place that writes to the gallery relation.
- If a future field added to `updateData` is list-visible but forgotten in `listVisibleFieldChanged`, layer 2 catches it — the field won't be in the allowlist, so revalidation runs automatically.

## What comes next

- **Phase 6D** — diff-based session/gallery sync; place subcategory diff guard.
- **Phase 6E** — route stop fingerprint short-circuit.
