# Birthday A5

| Surface | A4 | A5 |
| --- | --- | --- |
| Order detail | Raw order, request and quote stages | Shared read projection and separate estimate, proposed and agreed amounts |
| Submit | Transactional claim, request and outbox | Same transaction also links one private plan item |
| Business confirmation | Accepted quote and exclusive allocation | Same transition refreshes the linked plan item |
| Cancellation and expiry | Close requests and preserve orders | Update plan status or remove the cancelled entry from the active plan |
| Builder recovery | In-memory request key | Session checkpoint of IDs, version and key, scoped to the signed-in account |
| Notifications | PartyOutbox and existing delivery | Reused by the same transactions |

The plan item owner is the order owner. Only an explicitly selected, ACL-checked child is assigned. Guest counts are not identities. The wizard does not currently select named adult participants. Date and time are set from the final draft on submission. Existing rules require changes to a submitted booking to follow the order workflow. Manual plan editing and scenario replacement cannot change a linked birthday entry.

The migration adds an optional selected child identifier and a unique nullable plan link. On a database with manual legacy values, check for orphan or duplicate plan links before applying it. Existing orders are not backfilled automatically.
