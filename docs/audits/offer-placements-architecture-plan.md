# Offer Placements Architecture Plan

## Current Problem

- The offer wizard still contains legacy `birthday` and `service` UI/form fields.
- Those fields no longer have a matching persist layer in the current `Offer` model.
- `Offer.kind` in Prisma is limited to `EVENT | SERVICE`.
- Client-side `birthday` intent degrades to a generic service shape on save, so birthday is not preserved as a first-class offer type.

## Target Architecture

### OfferProductType

Represents what the business is actually selling, independently from discovery placement.

Examples:

- `CLASS`
- `CAMP`
- `SERVICE`
- `BIRTHDAY`

### OfferPlacementKey

Represents where an offer can be useful in product surfaces and discovery scenarios.

Examples:

- `CLASSES`
- `CAMPS`
- `BIRTHDAY`
- `PARTY_SERVICES`

### Placement State

Two separate layers are needed:

- `requestedPlacements`: placements requested by the business in the wizard
- `approvedPlacements`: placements approved by moderation for public use

This separation keeps moderation decisions explicit and avoids deriving public placement from legacy fields.

### OfferBirthdayDetails

Birthday needs a structured payload instead of ad hoc form-only fields.

At minimum this should cover:

- program / scenario
- duration
- child count or capacity notes
- included items

## Why The Old Selector Cannot Be Restored As-Is

- Legacy `birthday/service` fields are currently lost on submit.
- Public birthday output would have no reliable persisted source of truth.
- Moderation currently does not confirm or reject placements independently from the offer itself.

Restoring the selector before the data model exists would reintroduce a UI path that looks supported but still degrades at save time.

## Recommended Phases

### Phase 1

Fix the offer wizard stepper UX and document the target architecture without database changes.

### Phase 2

Add Prisma migration for:

- `productType`
- `requestedPlacements`
- `approvedPlacements`
- `birthdayDetails`

### Phase 3

Update the wizard UI to collect:

- product type
- scenario / placement intent

### Phase 4

Add moderation flow for placement approval.

### Phase 5

Launch public birthday feed(s) from approved `BIRTHDAY` placements only.
