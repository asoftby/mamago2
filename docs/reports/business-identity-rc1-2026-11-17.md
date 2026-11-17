# Business identity RC1

Scope: #1083 and the approved company/payer integration subset of #1123. No invoice, act, PDF, bank sync, merge or deployment.

Inventory reused: `Business` and its unique UNP/owner constraints; `createBusinessAction` and server OTP evidence; `resolveBusinessUnpVerification` / GRP; `businessVerification.service` and verification logs; owner-scoped payer-profile API and `BillingPayerProfile`; existing payer validation; company settings and billing navigation. No second registry integration, financial profile or moderation pipeline.

Business is canonical registration identity. New subject types are explicit; old records default to UNSPECIFIED. NPD FIO is private registrationFullName; public name is entered separately. NPD checks record result, official source, administrator and time, with an audit log; they do not approve mamaGo moderation. Approval rejects unconfirmed NPD. Normal GRP recheck refuses NPD.

Payer BUSINESS mode resolves identity from Business on every read and stores only a mode marker plus additional details. OTHER uses existing payer validation. Legacy profiles default to LEGACY_REVIEW: no inferred ownership, no read-time backfill or overwrite. Owner must explicitly clarify the mode. Neither payer mode writes Business or grants membership.

Company settings owns both sections. Old requisites route redirects; finance links point to company settings. Existing APPROVED records remain unchanged by migration or page load. An explicit change request can resubmit registration to moderation; normal editing is locked. Existing unique UNP/OTP checks remain; updates use optimistic concurrency to avoid overwriting concurrent moderation.

Runtime: payer read uses a unique owner lookup with its one-to-one payer relation (bounded; no lists/N+1), write uses unique owner lookup + upsert. Company form makes one GET on mount, no polling; no external calls for NPD submission/check recording. Company/IP reuse the existing single GRP lookup. No private shared cache. No measured latency/p95 or bundle improvement is claimed.

Verification: throwaway PostgreSQL migration deploy + five integration tests PASS (schema validation, owner isolation/forged identity, legacy preservation, NPD ACL/audit/approval restriction, idempotent migration); business phone trust tests PASS. Prisma Client generated. Final typecheck/lint/build and GitHub CI results are reported in PR, rather than inferred here. Mobile browser acceptance is separate from these automated checks. UI inventory commands ran; no primitive or global design-system migration.
