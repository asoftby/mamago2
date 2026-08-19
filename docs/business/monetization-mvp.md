# mamaGo first-PROD monetization

This document is the canonical product and engineering rule for first-PROD
Business monetization. Older billing reports describe historical scaffolding.

## Free

- A zero balance does not remove the Business or its existing basic presence.
- The approved MVP publication allowance remains available.
- Leads, applications and contacts are free. No live request path may create a
  `LEAD_CHARGE`.

## Paid

The only paid action is an explicit Boost purchase for an eligible published
Offer owned by the Business. Action-based Promotion is disabled.

Boost durations and owner-approved beta prices are `1 day = 5 BYN`,
`3 days = 12 BYN` and `7 days = 25 BYN`. Prices are authoritative only on the
server and are configured by `BOOST_PRICE_1D_BYN`, `BOOST_PRICE_3D_BYN` and
`BOOST_PRICE_7D_BYN`. All three values must be set in the deployment
environment. An option without a valid configured price is not offered; an
invalid configured price fails closed. The client submits an option ID, never
an authoritative price.

An already-active Boost is denied rather than extended or replaced. Boost
creation, ledger debit and balance decrement commit in one DB transaction and
one request key can create at most one purchase.

## Balance and top-up

- Balance is prepaid value denominated 1:1 in BYN.
- First-PROD top-up is a verified additive ADMIN operation only.
- Every admin credit/debit requires an idempotency key, actor and reason.
- Online payments and provider webhooks are not enabled.
- Balance does not expire and is never spent automatically.

`BillingAccount.depositBalance` is the operational cached balance.
`BillingTransaction` is the signed financial ledger. Every production balance
write must update both atomically through billing services.

## Refund and reversal

Internal balance reversal is allowed only for explicitly supported debit
operations and must reference the original transaction. Aggregate reversals
cannot exceed the original debit. A top-up or other credit can never be
"refunded" by adding another internal credit.

Refunding unused/top-up money is a manual reviewed external process. There is
no automatic provider refund in first PROD.

## Reconciliation

Run `pnpm billing:reconcile`. It compares every account's stored balance with
the sum of `SUCCEEDED` ledger movements, reports every mismatch, exits non-zero
on divergence and never changes data.
