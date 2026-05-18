# Save Flows Revalidate / Refresh Audit

Date: 2026-05-19
Scope: static code audit of publication save/edit/submit/moderation flows for events, offers, places, and routes in `mamago2`
Method: code-path inspection only; no application code changes, no browser trace capture

## Executive summary

The biggest save-flow cost is currently not global client runtime. It is server-side mutation work on publication editors, especially events and published-place revisions.

Main findings:

1. Event draft PATCH is the heaviest hot path in the project.
   - [src/app/api/business/events/[id]/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/business/events/[id]/route.ts:1) mixes draft save, published-content save, location sync, session sync, gallery sync, occurrence recompute, slug work, and revalidation planning in one route.
   - Even when public caches are not revalidated, draft save can still do several extra reads and replacement sync steps.

2. Event save is already relatively good on the client side.
   - [src/components/business/wizard/event/EventWizard.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/business/wizard/event/EventWizard.tsx:1) does not rely on `router.refresh()` after normal save/submit.
   - The bottleneck is server-side work, not forced RSC refresh from the editor.

3. Event schedule sync is guarded, but still expensive when triggered.
   - [replaceActivitySessionsFromScheduleJson()](/Users/shapovalovalexey/dev/mamago2/src/lib/business/syncEventActivitySessions.ts:93) is still `deleteMany + createMany`.
   - [syncActivityNextOccurrenceAt()](/Users/shapovalovalexey/dev/mamago2/src/lib/business/eventMutationSideEffects.ts:61) always does another read/write pair.
   - PATCH also calls debug-state reads around session sync.

4. Event gallery sync is also guarded, but replacement is still full rewrite.
   - [replaceActivityGalleryFromMediaIds()](/Users/shapovalovalexey/dev/mamago2/src/lib/business/syncEventGalleryFromMediaIds.ts:72) still rebuilds the relation set instead of diffing rows.

5. Event revalidation scope is narrower than before, but still broader than ideal for some draft/business saves.
   - [revalidateEventMutationPaths()](/Users/shapovalovalexey/dev/mamago2/src/lib/business/eventMutationSideEffects.ts:203) always revalidates business list pages.
   - Draft save no longer refreshes public paths, but still pays for revalidation orchestration and list invalidation.

6. Published-place edit flow is autosave-heavy and revision-heavy.
   - [src/components/business/wizard/place/PlaceWizard.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/business/wizard/place/PlaceWizard.tsx:1) autosaves edit-mode changes every 2s via PATCH.
   - For published places, save-and-close and submit switch to revision APIs, which can copy snapshots and replace all revision images.

7. Place revision save/moderation paths do full image replacement.
   - [src/server/services/placeRevision.service.ts](/Users/shapovalovalexey/dev/mamago2/src/server/services/placeRevision.service.ts:1) repeatedly uses `deleteMany` + recreate for revision images and approved place images.
   - Approving a revision also copies opening-hours structures and replaces the full place image set.

8. Route save flow is refresh-light but DB-rewrite-heavy.
   - [src/server/services/route.service.ts](/Users/shapovalovalexey/dev/mamago2/src/server/services/route.service.ts:1) updates by deleting all stops and recreating them.
   - Client editor itself does not do `router.refresh()` after save, so this is mainly a mutation-shape optimization issue.

9. Offer save flow is comparatively light.
   - Offer create/update do not use `revalidatePath()` here and do not force editor refresh.
   - Remaining cost is repeated ownership/place checks, slug work, and media-usage sync on save.

10. Admin moderation surfaces still use `router.refresh()` after actions.
   - This is acceptable for now because those are low-frequency administrative actions.
   - It should not be the first optimization target ahead of event/place draft save hot paths.

Severity:

- Critical
  - Event draft PATCH route combines too many side effects and expensive syncs for the highest-frequency save path.
  - Event session/gallery replacement strategy still rewrites related rows instead of diffing.
- High
  - Published-place edit/revision flow replaces revision/place images and may copy large snapshots during moderation.
  - Event save path still does extra Prisma reads for slug/revalidation/occurrence debug state after update.
  - Event business-save revalidation still invalidates list pages on every qualifying save.
- Medium
  - Route saves replace all stops on every update.
  - Offer saves still do repeated access/lookups and synchronous media usage sync when media changes.
  - Admin moderation clients use `router.refresh()`, but on low-frequency flows.
- Low
  - Most editor clients already avoid blind `router.refresh()` after draft save.
  - Public-path revalidation for events is already correctly skipped for plain draft business saves.

## Save flows table

| Entity | Surface | Route/component | Trigger | Does `router.refresh`? | Does revalidate? | Revalidate scope | Heavy Prisma / side effects | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Event | Business editor | `EventWizard` + `/api/business/events/[id]` | Draft save | No | Yes | Business list paths via `revalidateEventMutationPaths(..., "business-save")` | Existing snapshot read, optional place/program reads, slug work, session fingerprinting, optional session replace, occurrence recompute, gallery diff and replace, venue/city sync, occasion sync, media usage sync | Critical | Phase 6B/6C/6D: keep client local, narrow draft revalidation more, and trim side effects on unchanged schedule/gallery/location |
| Event | Business editor | `EventWizard` + `/api/business/events/[id]/submit` | Submit/publish | No | Yes | Publish scope incl. public/admin/business event paths | Validation reads, possible session replace, next-session read, slug ensure, pending-location resolution, post-submit read | High | Keep strongly consistent; optimize only repeated reads and guards |
| Event | Business create | `/api/business/events` | Create draft | No | Yes | `business-save` | Create, session replace, occurrence recompute, gallery replace, venue/city sync, occasion sync, slug assignment, post-create slug read | High | Avoid running full sync stack on sparse early drafts where possible |
| Event | Admin moderation | `/api/admin/moderation/events/[id]` + `AdminEventRowActions` | Approve / changes / reject | Yes, in admin client | Yes | `moderation-status-change` or `visibility-change` | Moderation service, pending-location publish resolution on approve, slug ensure, notifications | Medium | Keep consistent; client refresh acceptable for admin surface |
| Offer | Business editor | `OfferWizard` + `/api/business/offers/[id]` | Draft save | No | No explicit revalidate here | None seen in route | Existing offer read, optional new place read, status/price recompute, slug task scheduling, media usage sync | Medium | Low-risk optimization later: avoid media sync when payload unchanged and trim extra ownership checks if possible |
| Offer | Business editor | `OfferWizard` + `/api/business/offers/[id]` | Submit/publish | No | No explicit revalidate here | None seen in route | Same as draft save, plus status/publishedAt transition | Medium | Audit downstream page consistency before adding or narrowing any cache invalidation |
| Offer | Admin moderation | `/api/admin/moderation/offers/[id]` | Approve / changes / reject | Likely via admin list refresh | No explicit revalidate in route | None seen | Status update, slug ensure on approve, notifications | Low | Not first perf target |
| Place | Business editor | `PlaceWizard` + `/api/business/places/[id]` | Edit autosave / draft save | No | No explicit revalidate here | None seen | Existing place read, optional logo lookup, `subcategory deleteMany + createMany`, post-write read, media sync | High | Phase 6D candidate after events: diff subcategories and avoid post-write rereads where response does not need them |
| Place | Business editor | `PlaceWizard` + `/api/business/places/[id]/revision` | Published place save-and-close | No | No explicit revalidate here | None seen | Get/create revision snapshot, revision update, temp-media attach path can `deleteMany` and recreate revision images | High | Separate light draft revision save from heavy media replacement; diff images |
| Place | Business/editor submit | `/api/business/places/[id]/submit` | Submit/publish | No | No explicit revalidate here | None seen | Validation read, optional media asset read/create/attach, publish/submit service call, final read | Medium | Keep consistency on submit; only trim repeated reads |
| Place | Admin moderation | `/api/admin/moderation/places/[id]` | Approve / changes / reject | Yes in admin client | No explicit revalidate here | None seen | Status update, possible slug publish, notifications | Low | Acceptable for low-frequency admin actions |
| Place revision | Admin moderation | `/api/admin/moderation/places/[id]/revision` | Approve / changes / reject | Yes in admin client | No explicit revalidate here | None seen | Full revision read incl. images/opening hours, place update, full place image replace, opening-hours copy, moderation logs, notifications | High | Phase 6F: isolate heavy approve path and consider diff-based image/opening-hours application |
| Route | Public/me editor | `RouteEditor` + `/api/routes/[id]` | Draft save / publish | No | No | None seen | Route ownership read, derive city from places, `routeStop deleteMany + create`, nested stop recreate | Medium | Phase 6E: diff stops or at least skip full replace when stop fingerprint unchanged |
| Route | Public/me list | `RoutesClient` + `/api/routes/[id]` | Delete | Yes | No | None seen | Delete route, then client refresh list | Low | Keep for now; not part of save hot path |

## Events

### Business event PATCH

The event PATCH route is currently the most important save-flow optimization target.

Observed behavior in [src/app/api/business/events/[id]/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/business/events/[id]/route.ts:1):

- Loads an `existing` snapshot with many fields and relations before update.
- May read place again if venue/place changed.
- May resolve organizer/program constraints before write.
- After update it can still do:
  - `assignActivitySlugIfMissing()`
  - `replaceActivitySessionsFromScheduleJson()`
  - `syncActivityNextOccurrenceAt()`
  - `getActivityOccurrenceDebugState()` before/after session sync
  - `replaceActivityGalleryFromMediaIds()`
  - `syncEventVenueAndActivityCity()`
  - `syncActivityOccasions()`
  - `resolveEventRevalidationTargets()` / `resolveCanonicalEventPublicPathById()`
  - `syncActivityMediaUsage()`

Why this matters:

- This route serves the highest-frequency draft save path.
- It mixes cheap text edits with expensive schedule/media/location side effects.
- Even with guards, the route shape makes each save vulnerable to expensive branches.

### Editor event save

The good news is that the client editor is already fairly disciplined.

Observed behavior in [src/components/business/wizard/event/EventWizard.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/business/wizard/event/EventWizard.tsx:1):

- Draft save uses fetch and local state updates.
- Submit uses PATCH plus explicit submit endpoint.
- No routine `router.refresh()` after save.
- Navigation after success is mostly `router.push()` to the next meaningful destination.

Conclusion:

- Event save performance should be improved on the server first.
- Replacing the client flow is not the primary win.

### Admin moderation

[src/app/api/admin/moderation/events/[id]/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/admin/moderation/events/[id]/route.ts:1) correctly treats moderation as a stronger-consistency flow:

- approve uses moderation service
- then runs `revalidateEventMutationPaths()` with moderation-specific scope
- admin client actions use `router.refresh()` afterwards

This is acceptable because moderation is low frequency and public visibility can change.

### Schedule/session sync

The current stack already has useful guards, but not cheap execution once triggered:

- [activitySessionsMatchScheduleJson()](/Users/shapovalovalexey/dev/mamago2/src/lib/business/syncEventActivitySessions.ts:1) can prevent unnecessary full replacement in some flows.
- [replaceActivitySessionsFromScheduleJson()](/Users/shapovalovalexey/dev/mamago2/src/lib/business/syncEventActivitySessions.ts:93) still does `deleteMany + createMany`.
- [syncActivityNextOccurrenceAt()](/Users/shapovalovalexey/dev/mamago2/src/lib/business/eventMutationSideEffects.ts:61) adds an extra `findFirst` and `update`.
- PATCH adds extra debug reads around occurrence state.

Recommendation:

- First PR should not rewrite session sync logic entirely.
- Safer first step: remove debug-state reads from normal draft save path and strengthen schedule-change guards before calling replacement.

### Gallery/media sync

The route already tries to avoid unnecessary rewrites:

- [activityGalleryMatchesIncomingMediaIds()](/Users/shapovalovalexey/dev/mamago2/src/lib/business/syncEventGalleryFromMediaIds.ts:1) checks current vs incoming gallery state.

But when the branch is taken:

- [replaceActivityGalleryFromMediaIds()](/Users/shapovalovalexey/dev/mamago2/src/lib/business/syncEventGalleryFromMediaIds.ts:72) deletes and recreates gallery rows.
- `syncActivityMediaUsage()` may also run afterwards.

Recommendation:

- Keep the guard.
- Add a later PR for diff-based gallery writes or at least narrower replacement triggers.

### Public path revalidation

[src/lib/business/eventMutationSideEffects.ts](/Users/shapovalovalexey/dev/mamago2/src/lib/business/eventMutationSideEffects.ts:1) is already doing better than a naive always-refresh approach:

- `business-save` skips public targets
- `published-content-save` resolves public targets but marks them as skipped
- only publish/moderation/visibility/slug/city scopes sync-revalidate public pages

Remaining issue:

- event save still always invalidates business list pages
- draft save still pays for revalidation plumbing when changes are fully local/editor-only

Recommendation:

- Phase 6C should focus on narrowing business-save revalidation and separating purely local editor edits from list-visible mutations.

## Offers

Offer save flow is notably lighter than event save flow.

Observed behavior:

- [src/components/business/wizard/offer/OfferWizard.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/business/wizard/offer/OfferWizard.tsx:1) saves via fetch and local state; no routine `router.refresh()`.
- [src/app/api/business/offers/[id]/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/business/offers/[id]/route.ts:1) does:
  - existing offer ownership read
  - optional place read if place changes
  - price recompute
  - offer update
  - deferred slug scheduling
  - media usage sync when cover/gallery changed
- [src/app/api/business/offers/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/business/offers/route.ts:1) create path does similar validation plus image uniqueness checks

Main findings:

- No obvious `revalidatePath()` hot-path issue in the route itself.
- No editor-side `router.refresh()` issue.
- The main remaining cost is repeated validation/access work and synchronous media usage sync.

Risk level:

- Medium, but lower priority than events and published-place revisions.

## Places

### Business place PATCH

[src/app/api/business/places/[id]/route.ts](/Users/shapovalovalexey/dev/mamago2/src/app/api/business/places/[id]/route.ts:1) is less complex than event PATCH but still not cheap:

- reads current place
- may validate categories
- may lookup logo image
- updates place
- if subcategories provided, does `deleteMany + createMany`
- may assign slug
- does final `findUnique` for response
- may sync media usage

This matters because [PlaceWizard](/Users/shapovalovalexey/dev/mamago2/src/components/business/wizard/place/PlaceWizard.tsx:1) autosaves edit-mode changes every 2 seconds.

### Place revisions

Published-place editing is the second most important performance zone after events.

Observed behavior in [src/server/services/placeRevision.service.ts](/Users/shapovalovalexey/dev/mamago2/src/server/services/placeRevision.service.ts:1):

- `getOrCreatePlaceRevision()` snapshots the full place plus images.
- `savePlaceRevisionDraft()` may attach temp media by deleting all revision images and recreating them.
- `submitPlaceRevisionForModeration()` may again delete revision images and recreate them from temp media.
- `approvePlaceRevision()`:
  - loads revision with place, images, and opening-hours graph
  - may copy opening hours into a new tree
  - deletes all place images
  - recreates all place images from revision
  - marks revision approved and logs moderation

Main risk:

- The published-place editing path mixes autosave-friendly editing with snapshot-style copy workflows.

### Admin place moderation

Initial place moderation and revision moderation appear functionally consistent, but not particularly optimized:

- admin clients refresh after action
- services do full reads and full-copy work on approval

This is acceptable for frequency reasons, but it should stay out of draft/autosave hot paths.

## Routes

Route editor is relatively healthy on the client and relatively wasteful on the DB side.

Observed behavior:

- [src/components/routes/RouteEditor.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/routes/RouteEditor.tsx:1) saves through fetch and redirects on success; no routine `router.refresh()`.
- [src/server/services/route.service.ts](/Users/shapovalovalexey/dev/mamago2/src/server/services/route.service.ts:1):
  - derives city from placeIds
  - on update reads route ownership
  - does `routeStop.deleteMany({ where: { routeId } })`
  - then recreates all stops through nested create

Main finding:

- Route save is not suffering from broad RSC refresh.
- It is suffering from full child-row replacement on every update.

Secondary note:

- [RoutesClient](/Users/shapovalovalexey/dev/mamago2/src/app/(public)/me/routes/RoutesClient.tsx:1) does `router.refresh()` after delete, but that is not the main save bottleneck.

## Client-side refresh audit

### Where `router.refresh()` appears relevant to audited surfaces

- [src/app/(public)/me/routes/RoutesClient.tsx](/Users/shapovalovalexey/dev/mamago2/src/app/(public)/me/routes/RoutesClient.tsx:1)
  - used after route delete
- [src/components/admin/moderation/AdminEventRowActions.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/admin/moderation/AdminEventRowActions.tsx:1)
  - used after admin event moderation actions
- [src/components/admin/PlaceModerationView.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/admin/PlaceModerationView.tsx:1)
  - used after place moderation actions
- [src/components/admin/PlaceRevisionModerationView.tsx](/Users/shapovalovalexey/dev/mamago2/src/components/admin/PlaceRevisionModerationView.tsx:1)
  - used after revision moderation actions

### Where `router.refresh()` is notably absent

- business event draft save
- business offer draft save
- business place draft save
- route editor save

Conclusion:

- The main save/edit performance issue is not widespread blind client refresh.
- `router.refresh()` removal should target a few admin/list flows only after server-side save cost is addressed.

### Where optimistic/local state can win later

- route delete list refresh can eventually become local-state only
- admin moderation list refresh can eventually use local row removal/status patching

### Where refresh is still justified

- admin moderation surfaces after approve/reject/status changes
- any flow where server-rendered queue counts and cross-list membership must be immediately consistent

## Server-side revalidation audit

### Where revalidation looks too broad

Primary concern:

- [revalidateEventMutationPaths()](/Users/shapovalovalexey/dev/mamago2/src/lib/business/eventMutationSideEffects.ts:203) always revalidates:
  - `/business/events`
  - `/business/publications/events`

This is probably broader than necessary for every draft save, especially when:

- title/description changed but list cards may not be visible immediately
- internal editor-only fields changed
- save is part of frequent iterative editing

### Where revalidation already looks correctly constrained

- event `business-save` does not hit public paths
- event `published-content-save` skips public path revalidation
- publish/moderation/visibility/slug/city changes do revalidate public/admin paths

### Where draft save probably should not touch public pages

- event draft save: already mostly true, should stay true
- place draft save: no public revalidate seen, good
- offer draft save: no public revalidate seen, good
- route draft save: no public revalidate seen, good

### Where narrow revalidation is still needed

- event publish/submit
- event moderation approve/reject/status changes
- slug or city changes for published public entities
- any flow that changes canonical public URL or public list membership

## Prisma / DB mutation audit

Main repeated-read patterns:

- Event PATCH:
  - pre-update `existing` read
  - optional place/program/organizer reads
  - optional slug read after assignment
  - optional debug-state reads
  - optional public-path resolution reads
- Event submit:
  - validation read
  - schedule sync checks
  - next session read
  - post-submit final read
- Place PATCH:
  - existing read
  - optional logo lookup
  - post-update final read
- Place revision approve:
  - large revision graph read
  - additional writes for opening hours and images
  - follow-up notification/improvement work

Main replace-all mutation patterns:

- event sessions: `deleteMany + createMany`
- event gallery rows: full replacement
- place subcategories: `deleteMany + createMany`
- route stops: `deleteMany + nested create`
- place revision images: `deleteMany + recreate`
- approved place images from revision: `deleteMany + createMany`

Main expensive sync patterns:

- `syncActivityNextOccurrenceAt`
- `syncEventVenueAndActivityCity`
- `syncActivityOccasions`
- `syncActivityMediaUsage`
- revision opening-hours copy on place approval

Likely diff-based optimization opportunities:

1. Event sessions
   - Keep existing schedule fingerprint guards.
   - Later replace full row rewrite with diff-based upsert/delete only if safe.

2. Event gallery
   - Keep current equality guard.
   - Later patch only changed positions/items.

3. Place subcategories
   - Compare sorted ids before `deleteMany + createMany`.

4. Route stops
   - Add stop fingerprint and skip full replace when unchanged.
   - Longer-term diff child rows instead of full delete/recreate.

5. Place revision images
   - Avoid full delete/recreate on every temp-media attachment if unchanged.

## PR-sized fix plan

### Phase 6B: remove `router.refresh` from draft-adjacent saves

Safe scope:

- Keep business editors unchanged if they already avoid refresh.
- Target only low-risk list/admin flows where local state can replace refresh:
  - route delete list
  - selected admin moderation tables, if easy

Why not first:

- This is not where most save latency currently comes from.

### Phase 6C: narrow event draft revalidation

Safe scope:

- Review `business-save` event mutations and split:
  - editor-only save
  - business-list-visible save
- Avoid invalidating `/business/events` and `/business/publications/events` for fields that do not affect those surfaces.

### Phase 6D: optimize schedule / gallery / place-subcategory sync guards

Safe scope:

- Remove event occurrence debug reads from normal PATCH save path.
- Strengthen schedule-change guards before calling replacement.
- Strengthen gallery-change guards.
- Compare place subcategory ids before replacement.

### Phase 6E: route editor save flow

Safe scope:

- Add stop fingerprint/unchanged short-circuit in `updateRoute`.
- Keep response shape and client UX unchanged.

### Phase 6F: admin/business moderation and revision revalidation

Safe scope:

- Audit whether place/offer moderation needs explicit narrow revalidation or already relies on dynamic SSR.
- Separate heavy published-place revision approval work from lighter draft revision saves.
- Consider diff-based image application for revision approval.

## Safety rules

Do not change these blindly:

1. Publish and moderation flows for public events.
   - Public page availability, canonical paths, city landing pages, and moderation queues must stay strongly consistent.

2. Slug-changing flows.
   - Any save that changes canonical public URL must keep explicit revalidation or equivalent consistency.

3. City-changing flows for published events.
   - Public city pages and canonical links depend on this.

4. Published-place revision approval.
   - Opening-hours copy, image application, and moderation state must remain consistent even if expensive.

5. Submit/publish validation paths.
   - Draft-save optimization must not weaken submit-time validation guarantees.

Paths and flows that should still revalidate on publish:

- published event page
- relevant city event listing pages
- business publications/event lists when publication status changes
- admin moderation/content event lists on moderation or publish transitions

Flows that should remain strongly consistent:

- event publish / approve / reject / visibility changes
- place publish / approve / reject
- place revision approve / needs-revision / reject
- any flow that changes list membership, canonical URL, or public visibility

Flows that are best candidates for weaker consistency or no immediate refresh:

- event draft save with editor-only changes
- place draft autosave
- route draft save
- offer draft save

## Notes and assumptions

- This audit focuses on save/edit/submit/mutation code paths, not browser waterfall traces.
- Some list pages may be dynamic enough that missing explicit `revalidatePath()` is not currently a correctness issue; this report does not assume static caching without confirming code paths.
- The report intentionally separates hot-path draft save work from low-frequency moderation operations so that the first follow-up PRs can stay small and safe.
