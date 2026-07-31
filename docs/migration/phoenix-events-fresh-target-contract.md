# Phoenix Events fresh-target contract

The Phoenix Events executor is a one-time, fresh-target release mechanism. It
is lineage-authoritative and is not an ongoing WordPress synchronization
service.

Before planning or writing its first record, the executor scans all Activity
IDs and active ACTIVITY MigrationLineage rows. Any Activity without lineage
blocks the whole phase with `EVENTS_UNCLASSIFIABLE_TARGET_STATE`; duplicate
lineage source keys, duplicate lineage target IDs, and lineage rows missing
their Activity also fail closed. Only safe IDs and counts may be reported.

After preflight, per-record state is determined only by the exact active
lineage: absent lineage means `CREATE`; matching lineage, target and hash means
`SKIP_UNCHANGED`; a missing target or changed hash means `CONFLICT`; duplicates
mean `FAILED`. There is deliberately no per-record `TARGET_WITHOUT_LINEAGE`
classification because Activity has no reconstructable source natural key.

Each CREATE uses one Prisma interactive transaction containing Activity,
schedule/session rows, EventVenue when applicable, and MigrationLineage. The
executor is sequential, stops on the first failure, has no UPDATE path, does
not retry non-idempotent writes, does not adopt uniqueness-conflicting rows,
and performs no media binary writes.

Raw input comes only from `events/capture.json` below the root supplied by
`PHOENIX_RELEASE_ARTIFACT_ROOT`. The complete private artifact checksum and
schema version are verified before loading exactly one record. Apply never
queries WordPress and the loader never logs raw Event content.
