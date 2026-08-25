# mamaGo Analytics Contract v1

Status: canonical contract for new analytics code.

## 1. Layers and ownership

mamaGo analytics is deliberately split into four layers. They must not replace each other.

1. **Domain state — source of truth**
   - `Idea` / `ArticleIdea` / `PlaceIdea` / `OfferIdea`
   - `PlanItem`
   - booking domain records
   - `BillingTransaction`
   - `Boost`
   - other transactional domain tables

   If a business/product fact can be derived from domain state, the domain table is authoritative.

2. **First-party product telemetry — behavioral history**
   - `UserEvent`
   - `SearchQueryLog` for search-specific analytics

   Telemetry describes what happened around the domain action. It must never create the business fact itself.

3. **Derived profiles and reports**
   - `UserBehaviorProfile`
   - admin analytics/performance reports
   - business publication performance
   - Boost performance

   These are derived data and may be rebuilt from authoritative state/event history.

4. **External web analytics**
   - GA4
   - Yandex Metrica
   - future marketing/ad pixels

   External analytics receives a privacy-safe subset after consent. It is never the source of truth for billing, ranking, business KPI, saves, plan adds or bookings.

## 2. Canonical event semantics

| Product fact / signal | Canonical meaning | Source of truth | `UserEvent` |
| --- | --- | --- | --- |
| Page view | Public pathname was opened/navigated to | `UserEvent` | `PAGE_VIEW` |
| Card impression | A content card became meaningfully visible | `UserEvent` | `CARD_VIEW` |
| Detail open | A concrete publication/detail became active/open | `UserEvent` | `DETAIL_OPEN` |
| Save to ideas | A new ideas row was actually created | Idea domain row | `SAVE` |
| Remove from ideas | An existing ideas row was actually removed | Idea domain row | `UNSAVE` |
| Add to plan | A new `PlanItem` was actually created | `PlanItem` | `PLAN_ADD` |
| Move/update plan item | Existing `PlanItem` changed date/time | `PlanItem` | no `PLAN_ADD` |
| Remove from plan | An existing `PlanItem` was actually removed | `PlanItem` | `PLAN_REMOVE` |
| CTA click | User intentionally activated a conversion/navigation CTA | `UserEvent` | `CTA_CLICK` |
| Search | A real search request and its result count | `SearchQueryLog` | do not duplicate by default |
| Filter apply | User applied discovery filters | `UserEvent` | `FILTER_APPLY` |
| Booking lifecycle | Booking actually changed lifecycle state | booking domain record | `BOOKING_*` |

## 3. Metric definitions

The word **views** is forbidden in new analytics code unless its exact meaning is obvious from the field name or UI label.

- `pageViews` = count of `PAGE_VIEW` only.
- `cardImpressions` = count of canonical content `CARD_VIEW` events only.
- `detailOpens` = count of `DETAIL_OPEN` only.
- `saves` = count of real state transitions into Ideas (`SAVE`).
- `planAdds` = count of real `PlanItem` creations (`PLAN_ADD`).
- `ctaClicks` = count of real CTA activations only.

Do not sum `PAGE_VIEW + CARD_VIEW` into a generic `views` metric.

A `CARD_VIEW` used as a transport event for an inner UI block (for example `article_telegram_cta_impression`) is not a content card impression.

For legacy response fields named `views`, until their public shape is migrated, the canonical meaning from Contract v1 is **content card impressions only**.

## 4. Article interaction telemetry

Article milestones/interactions may currently be transported through legacy `UserEventType` values with the specific action in `meta.articleEvent`.

These legacy transport events must not contaminate conversion CTA metrics:

- `article_read_25`
- `article_read_50`
- `article_read_75`
- `article_complete`
- `next_article_loaded`
- `article_section_exhausted`
- `article_rating_submitted`

If transported as `CTA_CLICK`, they are **not CTA clicks** for aggregates, ranking, B2B analytics or conversion reports.

Likewise, `article_telegram_cta_impression` transported as `CARD_VIEW` is an impression of an inner CTA block, not an impression of the article/content card.

Real article CTA actions such as `article_telegram_cta_click` remain canonical CTA clicks.

A future enum migration may introduce dedicated article engagement event types, but Contract v1 does not require a database migration to correct metric semantics.

## 5. Idempotency rule

Telemetry for domain state changes is emitted only when the state actually changes.

Examples:

- Repeating POST `/api/save/idea` for an item already in Ideas must not create another `SAVE` event.
- Removing an item that is not in Ideas must not create `UNSAVE`.
- Moving an existing plan item to another date must not create another `PLAN_ADD`.
- Deleting a missing plan item must not create `PLAN_REMOVE`.

## 6. UserBehaviorProfile semantics

`UserBehaviorProfile` is a derived cache, not a ledger.

From Contract v1 onward:

- `totalViews` means canonical content card impressions (`CARD_VIEW`), not page views or impressions of inner CTA blocks.
- `totalOpens` means detail opens.
- `totalSaves` means real saves.
- `totalPlanAdds` means real plan creations.
- `totalCtaClicks` means real CTA clicks and excludes article reading/rating milestones.
- `preferredCategories` must only be incremented from actual category metadata. Entity type (`EVENT`, `PLACE`, `OFFER`, `ARTICLE`) is not a category.

Historical profile values from before Contract v1 may contain legacy semantics and should be treated as rebuildable data.

## 7. Traffic vs product engagement

Traffic and engagement are intentionally separate.

**Traffic**
- unique visitor = distinct session with at least one `PAGE_VIEW` in the selected window;
- page views = `PAGE_VIEW` count.

**Product engagement**
- card impressions = canonical content `CARD_VIEW`;
- detail opens = `DETAIL_OPEN`;
- saves / plan adds / CTA clicks = canonical product actions.

A session that only emits background product telemetry is not automatically a traffic visitor.

## 8. Promotion / Boost

`Boost` is the current promotion mechanism for first PROD. Legacy action-based `Promotion`/`PromotionAction` code must not be used as the source of current Boost performance unless explicitly re-enabled by product decision.

Boost performance metrics are based on timestamped first-party events during the Boost interval:

- card impressions;
- detail opens;
- saves;
- plan adds;
- CTA clicks.

A same-duration previous-period comparison is a **comparison**, not causal attribution. UI/copy must not claim that every action during the period was caused by promotion.

## 9. External analytics contract

GA4/Yandex Metrica are added only after first-party semantics are clean.

External scripts:
- load only through the existing consent-aware analytics loader;
- are disabled when the analytics ID/config is absent;
- are disabled in dev/local by default;
- receive no billing ledger details, child personal data, private profile data or internal IDs that are unnecessary for analysis;
- mirror selected events, never replace first-party/domain sources of truth.

## 10. Naming rule for new work

Prefer explicit names:

- `pageViews`
- `cardImpressions`
- `detailOpens`
- `saveToIdeas`
- `addToPlan`
- `removeFromPlan`
- `ctaClicks`
- `bookingCreated`
- `bookingCompleted`

Avoid ambiguous names such as `views`, `leads`, `conversions` or `engagement` unless the UI/report defines exactly what is included.
