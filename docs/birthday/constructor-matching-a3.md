# Birthday Auto Builder A3

`constructorOffer.ts` projects saved Offer, PackageComponent, OfferBooking and Place data to the A1 contract. `constructorCandidates.service.ts` is the shared read path for existing parent discovery and provider matching. It applies the publication and business gates before loading BookingUnit evidence. The public catalog and draft validation reuse the same source and admission predicate. The contract additions for performer role, resource evidence and age ranges are optional.

| Evidence | Canonical source and behavior |
| --- | --- |
| Age and interests | Offer age policy and bounds, and system interest slugs. An authorized profile supplies age on the event date without exposing date of birth. Explicit incompatibility excludes an offer. Interests use shared recommendation weights. |
| Role and constraints | The existing role discriminator applies only to the animator category. Offer details and OfferBooking provide duration and participant limits where known. |
| Geography | Place territory proves on-site coverage. City selection resolves through TerritoryLegacyMap. Registration and address text do not prove travel or delivery coverage. |
| Availability | Existing BookingUnit rules, exceptions, blocks and active allocations determine AVAILABLE, PARTIAL, UNAVAILABLE or UNKNOWN. Alternatives preserve the original requested interval. Preparation and cleanup occupy the same resource. |
| Package | PackageComponent IDs and revisions are preserved. Recognized legacy included categories remain a fallback. Optionality does not imply removability. |
| Price | EXACT is a fixed amount, FROM a lower bound and ON_REQUEST a request for a quote. Conflicts and unsupported pricing remain unresolved. Only a resolved fixed amount becomes the draft price snapshot. Budget fit is soft. |
| Admission | Approved publication plus the shared predicate for active, verified businesses with active billing and a positive deposit. Boost is absent from ranking. |

Candidate reads use keyset pages of 200 and batch resources after hard filtering. The integration fixture measured 14 queries both before and after adding 20 offers to the same page. This measures query count within one page. Multi-page latency still depends on catalog size. The catalog response uses private/no-store so a change in admission takes effect on the next request.

The current wizard has no persisted structured travel or delivery zones. The server can evaluate explicit A1 service areas, but the current projection leaves them UNKNOWN. Adding the writer and defining territory coverage require a separate decision. A1 also leaves the canonical rating projection, conflicting tariff precedence, extensions and package removal pricing open. No schema migration or data backfill is needed for A3.
