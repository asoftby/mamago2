# Session resource rollout

`BookingAllocation` owns physical occupancy. A row has exactly one owner: a
booking request, an offer session or an activity session. Party quote links
remain request-owned. The PostgreSQL exclusion constraint covers all owners
and keeps half-open occupancy intervals. Session foreign keys restrict hard
deletion so deleting a session cannot silently free an active allocation.

## Compatibility

| Existing data | Schema rollout | Activation prerequisite |
| --- | --- | --- |
| Standard or party allocation | Keeps its request, quote and interval | None |
| Materialized offer session | Keeps its identity and participants | Explicit required resources and a resolved group identity |
| Recurring class rule | Keeps its existing schedule | Bounded materialization with resource checks |
| Activity session | Keeps its start and selected-session references | Verified end time and explicit resource assignment |
| Publication-to-resource link | Remains an eligible candidate | Business selects an explicit set for the session |

The schema phase creates no assignments. Apply the migrations in order. The
column change uses a short lock timeout, validation runs separately, and
the two foreign-key lookup indexes are built concurrently. If a concurrent
index build is interrupted, inspect its validity before retrying the migration.

## Read-only inventory

Run after the schema migrations with a read-only role on an authorized database.

```sh
psql -X -v ON_ERROR_STOP=1 -f scripts/ops/audit-session-resources.sql
```

The report covers materialized sessions starting in the next 90 days. It lists
active request counts, group counts, candidate and assigned resource IDs, and
possible overlaps with confirmed party allocations and calendar blocks. It
does not load client contact data or expand recurrence rules. A null conflict
result means the interval or resource is unknown. A false result only rules
out the overlap checked by that column. Review schedule rules, exceptions,
capacity, groups sharing a legacy session, and recurring dates before activation.

## Lifecycle integration

Use the tenant-scoped resource locks from PR #1206. Lock the session before
locking the union of its old and new resources in the shared PostgreSQL
order. Re-read availability under those locks and write the booking,
session and allocation changes in one transaction. Party confirmation and
manual blocks lock resources without acquiring session locks.

Fixed sessions retain their allocation when participants cancel. Cancellation
of the session releases occupancy in the same transaction as the state
change. A failed move rolls back the new interval and retains the old one.
Enable writes only after the schedule editors, confirmation and cancellation
paths honor those invariants. Group identity and event end times are added
with their respective runtime integrations.
