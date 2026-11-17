# mamaGo.by 2.0 — Government data request registry (Phase 1)

Status: isolated implementation. This is NOT a personal data disclosure system.

## Included

- Register claimed official incoming requests and their reference numbers, date, stated legal basis, requested categories, optional internal subject user ID.
- Admin-only case registry and detail page, review/reject/close statuses and note.
- Audit all case creation, case detail/list access and status transitions in the existing AdminAuditLog; writes and audit records share a database transaction.
- Validate field sizes and allowed transitions; refuse missing/foreign Origin for mutations.
- Keep this domain separate from phone storage, encryption, account deletion and retention work.

## Explicitly excluded

- No lookup by encrypted phone, no decrypted user data, no data search or export endpoints.
- No official document or attachment upload, transfer, delivery confirmation or external government integration.
- No approval workflow for disclosure, no automatic verification of official authority or legal basis.
- No changes to keys, phone columns, HMAC indexes, deleted user records or retention jobs.

Do not enter real personal identifiers, document scans, phone numbers or sensitive case details in the free-text fields. The presence of a case does not imply a request is valid or authorize personal data disclosure. CLOSED means administrative closure only, not successful delivery.

## Access and storage

- ADMIN only; MODERATOR and other roles have no page/API/service access. Sidebar hides link to non-admins.
- Additive Prisma model GovernmentDataRequest and isolated SQL migration.
- SubjectUserId is a stable, optional internal reference, deliberately not a User FK.
- All request metadata is protected by role checks, no-store responses and restricted read endpoints.
- Duplicate (authorityName, incomingNumber) is rejected.
- The full original written request must be stored through an approved separate offline process until secure attachments are implemented.
- For protected operational metadata, apply least-privilege database access and backup handling; no assumption of special encryption-at-rest is made here.

## Statuses and audit

Workflow:
- RECEIVED to IN_REVIEW or REJECTED.
- IN_REVIEW to CLOSED or REJECTED.
- CLOSED and REJECTED are terminal.
- REJECTED and CLOSED require a written resolution note.

Audit actions:
- GOVERNMENT_REQUEST_REGISTRY_VIEWED
- GOVERNMENT_REQUEST_VIEWED
- GOVERNMENT_REQUEST_CREATED
- GOVERNMENT_REQUEST_STATUS_CHANGED

Audit metadata deliberately omits legalBasis, requestedScope, subjectUserId and resolutionNote text. Sensitive values must not enter logger/error messages.

The current AdminAuditLog table is NOT immutable/WORM, so this phase is not a tamper-evident official disclosure log.

## Integration gate after Claude encryption

Before any actual disclosure of user data:
1. Confirm applicable statutory retention, jurisdiction and request legality with counsel.
2. Agree to one shared encrypted phone/retained identity service; do not duplicate decryption or account deletion logic.
3. Add secure document intake and authenticity verification, protected storage, step-up MFA and independent approval.
4. Enforce minimum necessary scope, protected recipient transfer and delivery evidence.
5. Create tamper-evident access, decrypt, export, transfer and destruction logging; also track denied attempts and retention.
6. Complete migration, backup/restore, authorization, CSRF, race and redaction tests.
7. No merge or PROD deployment without separate release approval.

## Test commands

Run in an installed checkout with the generated Prisma client:

- node --import tsx --test src/server/compliance/governmentRequests.policy.test.ts
- node --conditions=react-server --import tsx --test src/server/compliance/governmentRequests.service.test.ts

Manually verify denied USER/MODERATOR/unauthenticated access, admin-only navigation, cross-origin POST/PATCH, duplicate documents, failed audit inserts, concurrent transitions, case privacy and pagination.

Neither the unit tests nor the registry demonstrate legal compliance or secure production disclosure. 
