# Business booking decisions

The business inbox and Telegram launcher use the same selected-order drawer and tenant-authorized API. Selected-order authorization resolves active OWNER/MANAGER membership against the booking business. A URL identifier grants no access. Telegram authentication validates Business Bot initData and the live membership of the connected business.

Pending requests can be confirmed or rejected. Confirmed requests can be completed or cancelled by the business. Rejection and business cancellation require a standard reason. “Другая причина” requires a nonblank comment. The status and BUSINESS activity with actor, reason and timestamp commit together. Legacy rejection history remains readable.

Contacts are available only through the audited, rate-limited individual detail endpoint. NEW, CONFIRMED and REJECTED records remain subject to service-end expiry. CANCELLED records additionally require a persisted BUSINESS cancellation activity matching the current status. Unattributed and customer cancellations fail closed. COMPLETED and EXPIRED records are redacted. Undated requests expire 30 days after creation. Existing service-end resolution uses the visit end or the end of the scheduled Minsk day. Bulk lists always redact contacts and unstructured notes.

Event confirmation locks Activity before BookingRequest and reassesses seat policy and nonexpired occupancy. Offer confirmation locks the group, ordered resource units and session before BookingRequest. It reuses loadSlotSnapshot/calculateSlots, excluding its own seat/resource hold, and checks allocation expiry. PostgreSQL exclusion constraints remain authoritative for overlapping resources. PARTY requests retain the existing partyConfirm path and resource selection/locking.

The decision read occurs only when opening a pending request. There is no polling or shared private cache. Offer decisions add one request lookup and the existing bounded-time slot snapshot reads to confirmation. Decision snapshots restrict other requests to the relevant session/time window. No latency improvement has been measured.

## DEV acceptance

Use test users and synthetic contact details. Open a Telegram notification for one business and for a user representing two businesses. Verify the selected request, stale links, invalid initData, revoked membership and another business’s request. Submit standard rejection reasons and “Другая причина” with and without comment through both the drawer and direct API.

Confirm a held final seat, reduce capacity before confirmation and race confirmations. Check group lessons, exclusive resources, manual allocations and existing party confirmation. After business cancellation verify the reason and contact in the selected detail. Repeat after customer cancellation, visit completion, expiry and membership revocation. Check inbox, calendar, participants, user bookings and My Plan after each action.

“Предложить запись повторно” remains backlog. A future proposal must go through mamaGo and require customer acceptance.
