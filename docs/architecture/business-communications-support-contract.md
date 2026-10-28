# Communications and business support — contract (#878)

Status: design contract, **not an implementation**. Base: `dev`.

## Existing capabilities (reuse)
- Unified `/me/direct` groups `DirectThread` by `(businessId, customerUserId)`. `/business/direct` redirects there.
- `directAdmin.service.ts` already implements admin read views, complaints, risk signals, hiding, blocking, and system messages.
- `supportTelegram.ts` currently alerts on business access requests; it is not a support messaging transport.

## Boundaries
1. **Customer ↔ business Direct** remains bound to a customer and a publication occasion. Do not model the platform as a fake customer or business, and do not add support requests as `DirectThread` rows.
2. **Business ↔ mamaGo support** is a separate domain with business-scoped authorization. Reuse presentation components where practical, but not Direct's customer permissions or moderation status.
3. **Orders and bookings** remain the source of truth for order state. Conversations link to an order/publication, never replace its workflow.
4. **Admin intervention in Direct** uses the existing system-message mechanism, with visible sender label «Команда mamaGo» and audit attribution to the real admin/moderator. Never impersonate a participant.

## Proposed support domain
- `BusinessSupportThread`: id, businessId, createdByUserId, subject/category (optional), status `NEW | IN_PROGRESS | CLOSED`, createdAt, updatedAt, closedAt, lastMessageAt.
- `BusinessSupportMessage`: id, threadId, senderType `BUSINESS | STAFF | SYSTEM`, senderUserId (nullable for system), body, createdAt, hiddenAt (if later needed).
- Unique request id; multiple support threads per business allowed. Every read/write must resolve active business membership or ADMIN/MODERATOR. Status changes and admin actions must be audited.
- The support API must never accept a caller-provided senderType/senderUserId as authority. Derive from authenticated session. Validate body length, enforce rate limits, paginate list/history, and protect against cross-business IDOR.
- For launch, support is text-only. No file uploads, AI scanning of all conversations, or Telegram two-way replies.

## User experience
- Business sidebar: «Сообщения» with customer conversations and «Поддержка mamaGo». Footer «Помощь» opens support.
- Admin «Коммуникации»: «Диалоги», «Жалобы», «Поддержка». Preserve existing Direct administration; integrate rather than replace.
- Business support: list, new request, thread history, status. Staff replies in admin panel. In-app unread badge and business Telegram notification if linked.
- Delivery failure to Telegram must not roll back message creation. Prefer outbox/worker with idempotent notification keys; do not log sensitive message text.

## Moderation reuse and gaps to verify
- Inspect existing complaint workflow, risk-signal thresholds, block/unblock and hide audit events before adding new endpoints.
- Confirm the admin UI renders system messages as «Команда mamaGo» and that users can distinguish them from customer/business messages.
- Avoid mass reading of private dialogs: prioritize complaints, flagged risk, and user-initiated investigations. Log staff access where feasible.
- Provide user-facing notice of moderation and retention policy before release.

## Suggested implementation sequence (separate PRs)
1. Support schema/migration, authorization helpers, tests for business isolation.
2. Support read/write APIs, status transitions, audit and pagination.
3. Business/admin interfaces, reuse existing message components.
4. In-app + business Telegram notifications with retries/idempotency.
5. Moderation gap fixes and end-to-end regression.

## Release acceptance
- Business A cannot read or mutate business B support threads, including guessing IDs.
- Non-staff cannot access staff-only support views; staff actions are attributable.
- Existing customer Direct and bookings work unchanged.
- Admin message to customer Direct displays «Команда mamaGo».
- Notifications work with and without linked Telegram; no duplicate sends on retry.
- Desktop/mobile accessibility, loading/empty/error states, pagination and CI pass.

Implementation PRs must each revalidate their base against current `dev`; do not merge or deploy solely because this document is approved.
