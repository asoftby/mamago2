# Editorial Requests / Business Matching / Telegram Confirmation Audit

**Date:** 2026-06-14  
**Scope:** architecture audit only, no code or schema changes  
**Conclusion upfront:** do not implement the full feature yet

## 1. Executive summary

The codebase already has a clean enough backbone for an MVP, but only if the new feature reuses the existing ownership chain:

`Offer -> Place.ownerBusinessId -> Business -> Business.ownerUserId/UserNotification/TelegramConnection`

The strongest existing source of truth for matching is not `Business` itself and not `Activity`. It is:

1. `Offer.status = PUBLISHED`
2. `Offer.discoverySignalIds`
3. `Offer.classChipSlugs`
4. `Place.ownerBusinessId`
5. `Place.cityId`

That is good news: the desired product principle is already compatible with the current model.

The main gap is not matching. The main gap is orchestration:

1. There is no editorial-request domain model.
2. Telegram is connected at `User` level, not `Business` level.
3. Telegram interactive callbacks exist, but only for `DevTelegramBusinessApplication`, not for a generic business editorial flow.
4. Billing has a ledger/account foundation, but no “reserve after acceptance / charge after admin approval” workflow.

Recommended MVP shape:

1. Match businesses directly from published `Offer` rows, not from `Activity`.
2. Snapshot matched offer IDs and match reasons at send time.
3. Store recipients per `Business`, not per `Offer`.
4. Reuse the existing notification/Telegram infrastructure, but add a dedicated editorial-request orchestration layer instead of forcing this into generic `Notification` rows alone.

## 2. Existing architecture findings

### Business

Canonical business entity is `Business` in [prisma/schema.prisma](prisma/schema.prisma:867).

Important facts:

1. `Business.ownerUserId` is unique, so one owner user has one canonical business row.
2. Team access is modeled separately via `BusinessMember`; cabinet access now prefers membership over legacy owner fallback in [src/server/permissions/business-permissions.ts](src/server/permissions/business-permissions.ts:1).
3. Business has both workflow status (`status`, `verificationStatus`) and soft-operational visibility (`operationalStatus`).
4. Business does not have its own Telegram identity fields.
5. Billing is already attached directly to `Business` via `billingAccount`.

This means business eligibility can be decided cleanly, but Telegram delivery still resolves through a user account, not a business mailbox/chat.

### Offer ownership and taxonomy

Canonical offer entity is `Offer` in [prisma/schema.prisma](prisma/schema.prisma:1676).

Important facts:

1. `Offer` belongs to `Place` through `placeId`.
2. `Place` belongs to a business through `ownerBusinessId` in [prisma/schema.prisma](prisma/schema.prisma:984).
3. Business offer creation already enforces place ownership and linked business requirements in [src/app/api/business/offers/route.ts](src/app/api/business/offers/route.ts:1).
4. Offer matching fields already exist:
5. `status`
6. `kind`
7. `cityId` snapshot
8. `discoverySignalIds`
9. `classChipSlugs`
10. camp-specific fields and date fields

This is the strongest signal that the platform is already structured around “published offer metadata drives discovery”.

### Discovery / public mapping

Discovery is split:

1. `Activity` powers public events/discovery feeds.
2. Offers also have a separate public-discovery path, especially for classes/camps, in [src/server/discovery/classesDiscoveryFeed.ts](src/server/discovery/classesDiscoveryFeed.ts:1).

Critical finding:

1. Offer discovery already uses `getPublicPublishedOfferWhere()` and then traverses `offer.place.ownerBusinessId`.
2. Public visibility already filters out disabled/archived businesses via [src/server/public/publicContentVisibility.ts](src/server/public/publicContentVisibility.ts:1).

So the system already contains reusable offer-to-business eligibility logic. Duplicating matching rules elsewhere would be a mistake.

### Articles / publications

Article infrastructure is real and reusable:

1. `Article` exists in [prisma/schema.prisma](prisma/schema.prisma:2283).
2. Admin editor/service are mature in [src/lib/article/articleAdminService.ts](src/lib/article/articleAdminService.ts:1) and [src/components/admin/articles/ArticleEditorClient.tsx](src/components/admin/articles/ArticleEditorClient.tsx:1).
3. Article blocks can embed `OFFER` cards through `activityCard` blocks and resolve them in [src/lib/article/articleMvpRenderData.ts](src/lib/article/articleMvpRenderData.ts:171).

There is no existing “article <-> selected businesses accepted into editorial request” relation, but the rendering/editor layer is ready to consume accepted offers later.

### Notifications / Telegram

Notification foundation is strong:

1. `Notification`, `NotificationDelivery`, `UserNotificationPreference`, `NotificationPolicy`, `NotificationTemplate` already exist in schema.
2. `createNotification()` is the existing entry point in [src/server/services/notification.service.ts](src/server/services/notification.service.ts:1).
3. Business notification surface already exists in the cabinet at [src/app/business/(protected)/notifications/page.tsx](src/app/business/(protected)/notifications/page.tsx:1).

Telegram readiness is partial:

1. User-to-Telegram linking is implemented through `TelegramLinkToken` and `TelegramConnection`.
2. Delivery to Telegram is implemented.
3. Inline keyboard support exists in `TelegramChannel`.
4. Generic notification delivery currently builds URL CTA buttons, not business-action callbacks, in [src/server/notifications/telegram-delivery.ts](src/server/notifications/telegram-delivery.ts:1).
5. Callback mutation flow exists only for `DevTelegramBusinessApplication` in [src/server/services/telegram/TelegramWebhookService.ts](src/server/services/telegram/TelegramWebhookService.ts:1).

So Telegram is not “missing”, but editorial confirmations are not plug-and-play yet.

### Billing

Billing foundation is already real:

1. `BillingAccount`, `BillingTransaction`, `BillingActionRate`, `Subscription`, `PaymentMethod` are present in schema.
2. Business billing pages and admin billing pages already exist.
3. `BillingReferenceType.REQUEST` already exists, which is useful for editorial-request linkage.

But the current billing model is still a plain ledger/account system:

1. No reservation/hold/freeze concept exists.
2. No editorial-request-specific charge lifecycle exists.
3. No approval-linked charge orchestration exists.

That means “charge after admin approval” is feasible, but should be modeled explicitly rather than faked through existing generic transactions.

## 3. Relevant models and files

### Core models

1. `Business` / `BusinessMember` / `BusinessInvite`: [prisma/schema.prisma](prisma/schema.prisma:867)
2. `Place`: [prisma/schema.prisma](prisma/schema.prisma:984)
3. `Offer`: [prisma/schema.prisma](prisma/schema.prisma:1676)
4. `Activity`: [prisma/schema.prisma](prisma/schema.prisma:687)
5. `Article`: [prisma/schema.prisma](prisma/schema.prisma:2283)
6. `Notification` / `NotificationDelivery`: [prisma/schema.prisma](prisma/schema.prisma:1327), [prisma/schema.prisma](prisma/schema.prisma:2484)
7. `TelegramConnection` / `TelegramLinkToken`: [prisma/schema.prisma](prisma/schema.prisma:206), [prisma/schema.prisma](prisma/schema.prisma:221)
8. `BillingAccount` / `BillingTransaction`: [prisma/schema.prisma](prisma/schema.prisma:1863), [prisma/schema.prisma](prisma/schema.prisma:1963)
9. `SignalDefinition` / `EventCategory` / `DiscoveryTag`: [prisma/schema.prisma](prisma/schema.prisma:339), [prisma/schema.prisma](prisma/schema.prisma:503), [prisma/schema.prisma](prisma/schema.prisma:3975)

### Key services/routes

1. Business permissions: [src/server/permissions/business-permissions.ts](src/server/permissions/business-permissions.ts:1)
2. Business workspace and current offer queries: [src/server/services/business/businessWorkspace.service.ts](src/server/services/business/businessWorkspace.service.ts:1)
3. Offer create/list flow: [src/app/api/business/offers/route.ts](src/app/api/business/offers/route.ts:1)
4. Activity business alignment: [src/lib/auth/activityAccess.ts](src/lib/auth/activityAccess.ts:1)
5. Public offer visibility: [src/server/public/publicContentVisibility.ts](src/server/public/publicContentVisibility.ts:1)
6. Offer discovery feed: [src/server/discovery/classesDiscoveryFeed.ts](src/server/discovery/classesDiscoveryFeed.ts:1)
7. Notification service: [src/server/services/notification.service.ts](src/server/services/notification.service.ts:1)
8. Notification delivery: [src/server/services/notificationDelivery.service.ts](src/server/services/notificationDelivery.service.ts:1)
9. Telegram link/webhook: [src/server/services/telegramLink.service.ts](src/server/services/telegramLink.service.ts:1), [src/server/services/telegram/TelegramWebhookService.ts](src/server/services/telegram/TelegramWebhookService.ts:1)
10. Article admin/editor/render: [src/lib/article/articleAdminService.ts](src/lib/article/articleAdminService.ts:1), [src/lib/article/articleMvpRenderData.ts](src/lib/article/articleMvpRenderData.ts:171)

## 4. Current matching capabilities

### What already works

The codebase already supports the clean path:

1. Find only `Offer.status = PUBLISHED`.
2. Filter by city using `Offer.cityId` or `Place.cityId`.
3. Filter by offer taxonomy fields:
4. `discoverySignalIds`
5. `classChipSlugs`
6. `kind`
7. camp/date-specific fields when needed
8. Resolve recipient business through `Place.ownerBusinessId`.
9. Exclude businesses that are not publicly active using the same public rules as discovery.

### What should be the MVP source of truth

For MVP matching, use:

1. `Offer.discoverySignalIds` as the primary semantic matching layer.
2. `Offer.classChipSlugs` as a secondary shortcut for classes/camps surfaces.
3. `Offer.kind` and camp fields for coarse segmentation.
4. `Place.cityId` or `Offer.cityId` for geographic filtering.

Do not use as primary truth:

1. `Business.name`
2. `Business.status` alone
3. `Activity` rows
4. manual business flags like “birthday business”

### Raw Offers vs Discovery/Activity

Recommendation: editorial matching should query raw `Offer` rows, but should reuse the same public eligibility rules as discovery.

Why:

1. `Activity` is canonical for events, not for all offers.
2. Offer matching needs the real offer taxonomy fields anyway.
3. Discovery already proves that `Offer -> Place -> Business` works.
4. Re-implementing a separate “editorial discovery abstraction” before MVP would add complexity without removing much.

## 5. Telegram / notification readiness

### What exists

1. Telegram connection flow is implemented end-to-end for a user.
2. Telegram sending is implemented.
3. Inline keyboard buttons are implemented.
4. Notification policies/preferences by surface already exist.
5. Business notification center and settings already exist.

### What is missing for editorial confirmations

1. No generic callback payload format for editorial request actions.
2. No `EditorialRequestRecipient` state machine to mutate from callback.
3. No mapping from `Business` to “which user/connection should receive this editorial request”.
4. No generic admin send flow for selected businesses.
5. Current generic notification delivery path only emits URL buttons, not confirm/decline callback buttons.

### Readiness assessment

Telegram is **partially ready**:

1. delivery channel: ready
2. account linking: ready
3. callback infra: partially ready
4. business editorial confirmation domain: missing

## 6. Billing readiness

### What exists

1. One `BillingAccount` per business.
2. General ledger in `BillingTransaction`.
3. Admin and business billing surfaces.
4. Business-specific action rates.
5. `BillingReferenceType.REQUEST`, which can anchor editorial-request-related charges.

### What is missing

1. No reservation/hold/freeze model.
2. No editorial-request billing state.
3. No “accepted but not yet approved by admin” billing transition.

### Recommendation

For MVP, do **not** bill on Telegram acceptance.

Instead:

1. store acceptance on recipient row
2. let admin review accepted businesses
3. create billing transaction only after explicit admin approval or article inclusion decision

This aligns with current architecture and avoids inventing fake pending-money semantics.

## 7. Admin UX readiness

Admin surface is already broad enough for this feature.

Strong candidate placements:

1. under `Контент` if the feature is framed as editorial/article sourcing
2. under `Коммерция` if the feature is framed as paid placement operations
3. new sub-area under `Коммуникации` only if the emphasis is outbound messaging, which feels weaker for MVP

Best fit for MVP: **new admin subsection under content/editorial/publications, not under Telegram**.

Reason:

1. the source workflow starts from editorial intent
2. recipient preview is content/taxonomy-driven
3. Telegram is only one downstream channel

Reusable UI patterns already exist for:

1. admin list/detail pages
2. filters/tables
3. publication editor flows
4. notification policy management patterns

What does not exist yet is the specific editorial-request CRUD page.

## 8. Business cabinet readiness

Business cabinet already has:

1. notifications surface
2. publications sections
3. billing section

Minimal MVP after Telegram confirmation should **not** create a big new cabinet subsystem immediately.

Recommended minimal behavior:

1. Telegram is the primary action surface.
2. Business notification center can mirror status updates.
3. Optional later: add a small “Редакционные запросы” section only after there is enough workflow depth to justify it.

So for MVP, “notification only + stored recipient/admin tracking” is enough.

## 9. Recommended MVP architecture

### Core decision

Create a dedicated editorial-request orchestration layer, but keep all matching grounded in existing offer/business/taxonomy data.

### Recommended flow

1. Admin creates an editorial request.
2. Admin chooses city and taxonomy criteria.
3. Backend matches currently eligible published offers.
4. Backend groups matches by `businessId`.
5. Backend stores recipient snapshot rows.
6. Admin reviews recipients and sends selected ones.
7. Telegram message goes to the chosen user connection for that business.
8. Callback updates recipient status.
9. Admin later reviews accepted businesses.
10. Billing and article linkage happen only after review.

### What should not be duplicated

1. do not create a second business taxonomy
2. do not manually label business verticals as primary truth
3. do not create a second Telegram delivery subsystem outside existing notification/telegram services
4. do not create a parallel billing ledger
5. do not duplicate discovery eligibility rules differently from public published-offer rules

## 10. Proposed Prisma models/enums if needed

### Recommended MVP schema shape

Use dedicated models. Do not overload generic `Notification` for state storage.

```prisma
model EditorialRequest {
  id               String   @id @default(cuid())
  title            String
  description      String?
  cityId           String?
  status           EditorialRequestStatus
  criteriaJson     Json?
  articleId        String?
  createdByUserId  String?
  sentAt           DateTime?
  deadlineAt       DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model EditorialRequestRecipient {
  id                    String   @id @default(cuid())
  editorialRequestId    String
  businessId            String
  businessUserId        String?
  status                EditorialRequestRecipientStatus
  matchReasonJson       Json?
  matchedOfferIdsJson   Json?
  telegramConnectionId  String?
  telegramChatIdSnapshot String?
  telegramMessageId     String?
  sentAt                DateTime?
  acceptedAt            DateTime?
  declinedAt            DateTime?
  approvedAt            DateTime?
  billedAt              DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

### Recommendation notes

1. `criteriaJson` is enough for MVP. A separate criteria table is not required yet.
2. Recipient status should be per `Business`, not per `Offer`.
3. `matchedOfferIdsJson` should be a snapshot for MVP, not a relation.
4. `matchReasonJson` should store why the business matched.
5. `telegramChatIdSnapshot` is useful because Telegram/user linkage can change later.

### Why JSON snapshots are correct for MVP

1. Matching is point-in-time.
2. Offers can change after sending.
3. Admin needs an audit trail of why the recipient was contacted.
4. Storing snapshots avoids stale re-computation bugs.

## 11. Suggested API/service layer structure

Recommended services:

1. `editorialRequest.service.ts`
2. `editorialRequestMatching.service.ts`
3. `editorialRequestDelivery.service.ts`
4. `editorialRequestCallback.service.ts`
5. optional later: `editorialRequestBilling.service.ts`

Recommended boundaries:

1. matching service queries offers and groups by business
2. delivery service delegates to existing notification/telegram layers
3. callback service mutates only editorial recipient state
4. billing service runs only after admin approval

Do not let the webhook mutate business/article/billing state directly without going through an editorial-request service boundary.

## 12. Suggested admin routes/pages

Recommended MVP admin pages:

1. `/admin/content/editorial-requests`
2. `/admin/content/editorial-requests/new`
3. `/admin/content/editorial-requests/[id]`

Recommended page responsibilities:

1. list page: statuses, city, sent count, accepted count
2. create page: title, city, criteria, preview match
3. detail page: recipients, send action, response tracking, optional article link

I would avoid placing this first MVP under `/admin/communications/telegram`, because that would center the transport instead of the editorial workflow.

## 13. Risks and edge cases

1. A business may have multiple matched offers for the same request. Recipient state must still be one row per business.
2. A business may lose or gain matching offers after send. Snapshot reasons are required.
3. `Business` can exist while no active Telegram connection exists for its owner/team. Recipient can be matchable but not deliverable.
4. Telegram is user-level; if multiple business members exist, recipient user selection must be explicit.
5. Some places/offers may be user-created but not yet linked to `ownerBusinessId`. Those should not be treated as clean business recipients.
6. Public visibility already depends on active business operational state. Matching should decide whether to reuse that exact rule or a slightly broader internal-only rule.
7. Billing before admin review would create refund/reversal complexity the current product does not need yet.
8. If article linkage is added too early, the editorial-request model may become over-coupled to article drafts.

## 14. Step-by-step implementation plan

### Phase 1: Admin-only matching audit MVP

1. Add editorial request model + recipient snapshot model.
2. Build admin create page with city + offer-signal criteria.
3. Implement preview query:
4. only `PUBLISHED` offers
5. only business-owned places
6. group by `businessId`
7. store match snapshots
8. No Telegram yet.

### Phase 2: Telegram sending

1. Add recipient send action.
2. Resolve target user/Telegram connection.
3. Send Telegram message with inline buttons.
4. Store Telegram message metadata on recipient row.

### Phase 3: Confirmation flow

1. Add callback action format for editorial requests.
2. Update recipient statuses from Telegram.
3. Show counters/statuses in admin detail page.
4. Optionally mirror a business in-app notification.

### Phase 4: Review, billing, article linkage

1. Admin approves accepted businesses.
2. Create billing transaction only after approval.
3. Optionally add accepted offers/businesses into article workflow.
4. Only then decide whether a dedicated business-cabinet section is justified.

## 15. Explicit “Do not implement yet” conclusion

Do not start full implementation yet.

The repository already contains the right primitives, but the missing orchestration layer is important enough that jumping straight into code would likely create:

1. duplicate business classification
2. duplicate Telegram action handling
3. duplicate matching logic outside offer discovery/public rules
4. premature billing coupling

The correct first implementation phase is **Phase 1: admin-only editorial request creation and recipient preview based on published offers and taxonomy signals**.

## Final assessment

### Should implementation start now?

Not for the whole feature.  
Yes for a narrow Phase 1 only.

### Main blockers before Telegram phase

1. no editorial-request models
2. no business-to-recipient-user resolution strategy
3. no generic Telegram callback flow for editorial actions
4. no explicit billing lifecycle for post-acceptance charging

### Most important validated answer from this audit

Yes, there is already a clean path:

`published Offer -> matching taxonomy/signals -> Place.ownerBusinessId -> Business`

That is the path the feature should be built on.
