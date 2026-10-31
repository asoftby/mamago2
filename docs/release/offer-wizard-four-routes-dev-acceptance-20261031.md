# Offer Wizard v2 — four-route audit and DEV acceptance matrix (2026-10-31)

Status: **incomplete / DEV browser E2E not executed**. Base: `dev`, inspected 2026-10-31. This checklist distinguishes (a) requested behavior, (b) evidence in code, (c) missing verification or implementation; it does **not** claim an untested route works.

## Shared requirements (ALL four routes)

- [x] Four understandable entry choices: place visits, classes/workshops, birthday/party, camps/holidays. Code: `Step1Type`, `offerWizardV2Steps.ts`; PR #531.
- [x] Six v2 sections: Format, About, Services & Prices, Schedule, Terms & Contacts, Review. Code: `V2_STEPS`; PR #541.
- [ ] DEV business sees v2 on both create/edit. It remains behind `Business.features.newOfferWizard` by default. PR #1010 introduces **opt-in** DEV override, pending merge/configuration/deploy; production must stay unaffected.
- [ ] Remove duplicate no-kids/section selection/short catalog description, show core fields directly (no accordion hiding). Requires visual and code verification in all four routes.
- [ ] Unified first-class services/prices and **availability/calendar** experience; no competing independently saved values presented as one price. Current `Step5Pricing` plus independently saved `BookingServicesEditor` require data-flow reconciliation; initial offer ID is required for operational pricing editor.
- [ ] Optional inline subforms appear below the option clicked; do not jump to unrelated region.
- [ ] FAQ after contacts and before Review. Verify navigation and submission.
- [ ] Author selects facts; placement should be auto-classified, without duplicate entity creation or forced manual section choice.
- [ ] One calendar reflects online bookings, Telegram/phone/manual blocks, exceptions and capacity; prevent double booking (#824/#830). Must not claim external synchronization exists until verified.
- [ ] Draft create → reopen → edit → submit/moderate → publish → public page → update without field loss, including rollback on validation errors. Test business permissions, tenant isolation and mobile/desktop.
- [ ] All operational settings must survive a fresh page load and not be overwritten by old copy-edit forms.
- [ ] Mark test complete **only** against actual DEV deployed SHA, not PR merge status.

## Route 1: Посещение места

- [x] Route currently maps schedule to `conditions`, `openingHours`, `bookingMethod` (code `getV2StepMembers`).
- [x] `StepOpeningHours` offers day/week presets and per-day hours.
- [x] `StepBookingMethod` supports booking-method choice and legacy awareness.
- [ ] Clearly separate regular opening hours from bookable time windows/actual slot inventory and link location/resources (where supported).
- [ ] Prices and optional extras appear in one comprehensible step; verify saved operational vs display prices.
- [ ] Flexible modes: request, timed booking, external booking, with appropriate conditional fields; test each supported mode.
- [ ] E2E: create place-visit offer, configure hours and exceptions, price, save, reopen, publish and verify public CTA/bookability.

## Route 2: Занятия и мастер-классы

- [x] `getV2StepMembers` maps one-time/regular activity to `conditions`, `classSchedule`, `bookingMethod`.
- [x] `StepClassSchedule` contains group periods, weekdays/times and tariffs; inspect persistence with distinct periods.
- [ ] Group and tariff must map to correct booking option, seats, trial lesson, course/recurrence and variant; verify E2E, not just inputs.
- [ ] A regular class belongs to Classes by default, **not** Where to Go. A dated one-off workshop may belong to Where to Go, without duplicate Offer ID. Verify classification decisions.
- [ ] #564 and #581 were closed without merge; compare their implementation against current dev, do not cherry-pick blindly (potential group-period data loss).
- [ ] E2E: regular 2-group class with distinct periods + prices; save and reopen. Separate one-off workshop with a date, verify public classification and booking.
- [ ] Existing published class and historical bookings must remain compatible.

## Route 3: Дни рождения и праздники

- [x] First choice distinguishes PARTY_SERVICE and PARTY_PACKAGE; `about` includes placement, details, photo.
- [x] v2 services currently maps to `price` and separately mounts `BookingServicesEditor` after draft is saved.
- [x] Operational editor contains base price, included/optional/standalone items, optional resource IDs and duration extensions where backend allows; PRs #945/#947.
- [ ] **Critical**: party schedule currently maps only `openingHours` + `bookingMethod`. Opening hours ≠ inventory of reservable slots. Add real party slot/calendar workflow using availability engine, with preview and resource locks; never invent availability.
- [ ] Venue vs at-home vs outdoor service, moderator-visible categories (host != animator), minimum duration, optional hours/discount, included materials and timeline-based program. Make program timeline with time + description.
- [ ] Capacity/participants, time-zone, preparation/buffer, booking horizon, exceptions/manual holds and conflicts, if supported by core engine.
- [ ] Payment/prepayment/cancellation conditions; #565 still open, not on dev.
- [ ] A published party offer should support parent builder requests and authoritative price/capacity constraints, without exposing internal resource IDs.
- [ ] E2E: a package and a standalone service, save drafts and reload, configure resources/slots/prices/extensions, edit and publish, preview a real available slot, reject a conflicting reservation.
- [ ] Track consolidated implementation as issue #1011, not merely flag rollout #1010.

## Route 4: Лагеря и каникулы

- [x] v2 maps schedule to `campSchedule`, `accommodation`, `bookingMethod`.
- [x] `Step4CampSchedule` contains shift dates/price overrides and session handling; verify actual API serialization/persistence.
- [ ] Program timeline: time intervals and descriptions; location, day vs residential, capacity/ages and booking options.
- [ ] Each shift has its own dates, price/tariff, seats, publication/booking semantics; verify no accidental overwrites.
- [ ] Class/camp schedule code from unmerged #564 must be compared against current branch, but not assumed absent or merged.
- [ ] E2E: create multiple non-overlapping shifts with different prices, save, reload, edit one shift, publish, verify public page and request/availability.

## DEV sign-off evidence (repeat per route)

| Gate | Evidence required | Current status |
|---|---|---|
| Build | CI + exact PR HEAD and merge SHA | Not verified |
| Deployed code | DEV container SHA equals intended merge commit | Not verified |
| Create | Screenshot/video and test-offer ID | Not run |
| Save draft | API success and database persistence | Not run |
| Reopen/edit | Values unchanged across reload, independently edited fields stable | Not run |
| Publish | Status transition, moderation, public page and classification correct | Not run |
| Booking | Real slots, capacity, price & conflict enforcement relevant to route | Not run |
| Regression | Mobile/desktop, role isolation, legacy edit, no duplicate entities | Not run |

## Execution order

1. Settle #1010 CI and DEV-only rollout config; verify deployed SHA, no PROD override.
2. Audit data-model/API read-write against wizard fields and legacy compatibility; reconcile #564/#581 group-period issue and #565 terms.
3. Implement route-specific gaps, especially party calendar and first-save pricing step (#1011). Separate focused PRs with integration tests; avoid building another parallel booking engine.
4. Consolidated DEV deployment. Run real browser E2E for four routes with test account/tenant and capture ID, saved payload, published URL + screenshots; record failures here and fix before PROD.
5. Mark every row complete only after evidence is available. No production release based on this document alone.

## Current inspected sources

- `src/components/business/wizard/offer/offerWizardV2Steps.ts`
- `src/components/business/wizard/offer/OfferWizard.tsx`
- `src/components/business/wizard/offer/steps/StepClassSchedule.tsx`
- `src/components/business/wizard/offer/steps/Step4CampSchedule.tsx`
- `src/components/business/wizard/offer/steps/StepOpeningHours.tsx`
- `src/components/business/wizard/offer/steps/Step5Pricing.tsx`
- `src/components/business/wizard/offer/steps/StepBookingMethod.tsx`
- `src/components/business/wizard/offer/components/BookingServicesEditor.tsx`
- `src/app/(content-editor)/editor/offer/new/page.tsx`
- `src/app/(content-editor)/editor/offer/[id]/edit/page.tsx`

Historical constraints from project discussions on 2026-10-27 through 2026-10-31. This is a scoped acceptance checklist, not proof that feature or test has been completed.
