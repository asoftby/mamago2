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


## Guest SMS decisions

Guest STANDARD decisions enqueue a BookingSmsDelivery in the same PostgreSQL transaction as the status and decision activity. Registered users retain their existing notification channels. The delivery queue references the existing booking/history and stores no recipient phone, message text or raw provider response. BookingSmsAttempt records each bounded dispatch attempt.

The existing SMS.by sendQuickSms integration sends after the API response. The existing authenticated standard-booking-expiry cron drains pending and retryable work, up to ten rows per run. No extra deployment scheduler is required. Known provider refusal and missing configuration are retried at most three times, with five- and ten-minute delays. Accepted deliveries are not sent again. A timed-out request, malformed response, HTTP ambiguity or interrupted worker is quarantined as UNCERTAIN. The provider API documents no idempotency key for sendQuickSms, so ambiguous attempts require provider-side reconciliation before any resend. ACCEPTED means gateway acceptance, with the provider status and message ID recorded. It does not claim delivery to the handset.

A later business cancellation supersedes an unsent confirmation. Cleared/anonymized source phones and bookings linked to an account are skipped. Provider failure leaves the business decision committed. Atomic CAS claims prevent concurrent dispatchers from buying the same SMS twice.

Russian templates use Unicode SMS. Confirmation and each standard reason without an extra comment fit one segment with the visit date/time. Whitespace and redundant reason labels are removed. Custom explanations are preserved, with up to nine segments for the current 500-character comment limit. Estimated and provider-reported segment counts are recorded separately.

The public SMS.by SMS page lists 0.028 BYN per message for the lowest-volume bracket, while its tariff page displays 0.046 BYN for Belarusian operators. These pages differ, and the account-specific contracted rate has not been confirmed. A planning range is 0.028–0.046 BYN for a one-segment notification and 0.252–0.414 BYN for nine segments. These estimates cover Belarusian numbers. International destinations have different provider tariffs. Actual billing depends on the account tariff and provider-reported parts. Sources checked on 2026-11-25. [SMS.by SMS pricing](https://sms.by/sending-sms), [SMS.by tariffs](https://sms.by/tariffs), [SMS.by API](https://sms.by/api-docs/sms-messages/).

The additive 20261125143000_guest_booking_decision_sms migration creates delivery and attempt tables with unique decision and attempt keys. Existing data and notification records are retained. Apply migrations before the new app version. Tests use injected/mock SMS providers and disposable PostgreSQL, with no real SMS sent.
