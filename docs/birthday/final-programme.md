# Birthday programme, family access and public links

PR B is stacked on PR A #1175 (`e367c82fea6020510efed21e1b5ef5e53b034ce2`, six CI checks successful). No automatic merge/deploy. Original fresh dev base: `1de8857c70a87fe500b07992e16f156003b9b6f5`.

## Ownership and source of truth

PartyOrder/PartyOrderItem remain composition and status truth. `programme` stores only item IDs, presentation order and nullable local Minsk times. It never updates resource allocations, agreed windows, prices, snapshots or provider confirmations. Removed/replaced included components remain awaiting agreement until the existing booking flow cancels them. A confirmed canonical item takes precedence over a newer losing request.

The existing `/me/birthdays/[id]`, BirthdayPartyDayPlan and BirthdayPartyShareModal are reused. The owner can save order/time, select active adults and real child profiles, and save a single linked MANUAL/EVENT PlanItem. Children do not get User records. Every mutation uses the existing owner-only PATCH, strict bounded command schema and PartyOrder.version CAS; competing/stale/replayed commands return 409 without duplicated projections. Editing remains explicit, without autosave/polling. Date/time changes validate the programme and update its linked calendar record atomically. Cancellation closes the linked entry.

Family Core's existing scope/history rules apply. Only selected active adults see the linked family entry and limited programme; the owner must still belong to that family. Leaving revokes access on the next read. Ordinary private tasks are unchanged. Generic manual, visibility, delete and daily-scenario writers cannot change the linked projection. Calendar cards link back to the party.

## Public capability

Disabled by default. Explicit owner permission creates a 192-bit random capability with 1/7/30-day expiry. Rotation revokes the previous token; revocation clears it. Cancelled orders, expired/unknown/revoked links return 404. The exact redacted projection shown above the owner's controls is used for family and public readers: date, generic category titles, programme times and individual statuses only. If a later provider decision moves the actual service window outside a manual programme interval, the projection uses the current service interval and flags that the programme time needs correction; it never hides the booking confirmation. No catalogue/free-text titles, child names/DOB, private item IDs, contacts, location or money. The link never grants mutation rights.

The `/p/` URL lives in a minimal route group outside the discovery/family provider layout, so invalid tokens are checked before streaming and return actual HTTP 404. It does not mount analytics or private family contexts. Dynamic/no-store reads; noindex/nofollow/noarchive/nosnippet and no-referrer metadata. `/p/` uses the existing capability-path exclusion for external analytics and PAGE_VIEW. Telegram/WhatsApp controls contain only a generic caption and the explicitly enabled URL; QA checks their hrefs, without sending messages.

## Draft #1148 / A5 overlap

Draft #1148 remains unmerged. A5's exact `20261106043000_party_plan_link` migration is reused unchanged, including selectedChildId and unique nullable PartyOrder.planItemId FK; the programme-specific columns are in a separate migration. `partyPlan.service.ts` reuses A5's one-projection transactional approach, adapted to the current dev models rather than importing its unavailable A1 read-model dependency. Family visibility writes are protected as in A5. Future integration must reconcile these overlaps deliberately, not apply both implementations.

## Verification ledger

- Prisma Client generated and schema validated; both migrations deployed only to guarded loopback test DB `127.0.0.1:55443/mamago_birthday_it`. Full schema-diff exits 2 for pre-existing unrelated index/FK drift (13 other tables); comparison against the exact e367 base produces identical unrelated drift. No PartyOrder/PlanItem drift remains. No unrelated schema repair was attempted.
- Unit tests: strict schema, redaction, independent statuses/expired quotes, changed package components, programme interval bounds. Existing Family Core and birthday contracts exercised.
- PostgreSQL: owner/outsider ACL, concurrent CAS (one succeeds), foreign adult/child rejection, one PlanItem across repeated saves, private-task isolation, selected family reader, reader/owner leaving, immutable programme across reload, public redaction/expiry/rotation/revoke, draft date sync/conflict rollback, cancellation.
- Representative instrumented public read: **3 SQL statements**, **227 JSON bytes**, two services; no per-row queries or external calls. No p95/production-load measurement or speedup claim.
- Real Chrome: built and submitted a two-service order to isolated demo business, saved manual order/time and reloaded, selected adult and child profile, saved My Plan, logged in as second adult, opened the programme from the calendar. Anonymous public programme checked. Invalid/revoked links return actual HTTP 404 and a clear unavailable message in the minimal route layout. Copy link matched, Telegram/WhatsApp hrefs contained only generic caption + capability. No messages sent.
- Owner widths 320/375/390/768/1200; family/public 320/390/1200: document content width equals viewport width. Screenshots `/private/tmp/mamago-programme-{owner,family,public}-*.png` are local QA evidence, not deployed assets. UI Lab previews all seven canonical statuses using the actual timeline component.
- Initial targeted birthday-contract invocation without DATABASE_URL failed (existing honestBuilder test needs DB); rerun uses guarded isolated DB. This was not a product failure or a full gate.
- Independent review found and fixed: generic scenario delete/replace bypass; newest losing request masking canonical confirmation; date/plan drift; date/programme conflict before saving My Plan; analytics capability exclusion; changed INCLUDED confirmation. Browser QA fixed time-input event handling and disabled interactive fields before hydration.
- Full local pre-push gate: pending final candidate; no earlier full gate run for B. Exact final SHA/CI evidence belongs in the PR description.

## Explicit limits / PR C

Programme times are within-day presentation intervals, not booking modifications. Distinct providers may overlap; resource conflicts continue through the canonical confirmation/allocation process. Family readers cannot accept quotes, cancel or edit. The family/public programme intentionally omits personal labels and financial details.

Real constructor QA exposed existing context/time input issues and the on-site edited-package submit guard; these are tracked for PR C. District compatibility and unsupported HOME/OUTDOOR changed-package submission remain truthful BLOCKED, pending the corresponding contracts; no test state bypass is allowed. Post-submission replacement is not invented here. Do not release the complete journey as accepted until PR C's matrix and fixes are reviewed.
