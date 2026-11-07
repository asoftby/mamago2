# Changed birthday-package requests

Package rules are configured in the existing Offer wizard (prerequisite PR #1162). PackageComponent is the catalogue truth; existing PartyOrderItem snapshots retain the rules and monetary amounts selected for that order. `isOptional` never grants removal permission.

The parent edits the existing StepReview draft. Sending a changed package requires the existing `PARTY_CONFIRMATION_ENABLED` flag. When disabled, submission returns a definitive 422 and the composition remains editable. The existing business inbox release flag still controls its notifications; no environment flag is enabled by this PR.

Submission CAS claims the exact PartyOrder version and stores a typed `PARTY_PACKAGE_CHANGE` brief in BookingRequest.bookingPriceSnapshot. It contains the original component snapshots, kept/removed/replaced actions, fixed credits, independently selected services, and the package-only requested estimate. Catalogue price edits do not rewrite it. Existing standard-booking snapshots have a different shape and are ignored by this reader.

The package owner quotes only their package. EXACT may be agreed as requested only at the snapshot-derived amount. FROM, ON_REQUEST or a changed price require a modified quote with an explanation. Money uses Decimal; zero is valid, excess precision is rejected. The parent explicitly accepts the latest active, unexpired version or rejects it. Acceptance does not allocate capacity. Existing business confirmation rechecks publication, resource ownership, schedule, occupancy and the exclusion constraint. Removed included components become cancelled only at actual confirmation. Standalone replacements receive their own requests and remain independently unconfirmed.

Quote decisions, business replies and confirmation lock an item-scoped transaction mutex and its request group in stable order before resource/item/order changes. This covers competing sibling decisions, including invitations inserted during processing, without serializing unrelated items. The guard costs two bounded SQL round trips per manual action. Page loads do not acquire it.

No component polling or per-card requests were added. Normal inbox classification keeps its minimal historical projection and fetches briefs in one bounded batch for displayed party rows; a direct request link reads only the authorized request and its relations. Representative local focused view: 5 SQL statements, 3007 response bytes. This is fixture evidence, not a latency/p95 benchmark.

Existing PartyOutbox and NotificationDelivery own delivery, retry and deduplication. Events link to a specific business request or parent party. Telegram registry rendering preserves the persisted party action URL. Mocked-transport integration proves failure persistence, retry and duplicate suppression; it sends no real messages. An outbox SENT record means processing occurred, not proof of external delivery.

## Verification

Use Node 22 and the guarded disposable PostgreSQL at 127.0.0.1:55443/mamago_birthday_it. Apply migrations with Prisma migrate deploy; never use migrate-dev/reset scripts.

Run the birthday catalogue contracts, packageComponents.integration.test.ts, partyPackageChange.integration.test.ts, partyFullFlow.integration.test.ts, partyInviteDispatch.postgres.integration.test.ts and partyPackageNotifications.integration.test.ts. Server integrations need `NODE_OPTIONS=--conditions=react-server` and the existing confirmation flag enabled only in the test process. CI runs these tests for dev and the PR #1162 stack base.

`scripts/it/packageQuoteBrowserFixture.ts` creates local authenticated fixtures only after the guarded seed. Chrome acceptance covered component replacement/removal, reload, submit, business modified quote, parent acceptance, real resource confirmation, third-party isolation and parent rejection, with 320/390/1200 px checks. The package wizard was also walked from format selection to draft creation with all four policies and restoration at all three widths.

No new tables, migrations, backfill, deployments or automatic merges. Confirmed orders are not editable through this flow. PR #1148 remains separate and requires deliberate reconciliation of overlapping birthday, wizard and parent-order files.
