# Telegram capture: abuse limits and latency diagnostics

Scope: DEV validation first. Never promote to PROD until quotas, UX and current OpenRouter spend limits are verified.

## Application-side quotas (rolling 24h)

- 15 capture items per user (text or image album), including failed captures.
- 3 photos per album; 6 total photo parts per user.
- 3 MiB per photo and 4,000 characters per text input.
- 1,000 capture items across **all linked users** per Telegram environment.
- Global count protected with a PostgreSQL transaction-level advisory lock, acquired in the fixed order: per-user -> environment -> album.
- Deduplicated Telegram updates do not consume quota again.
- Existing Telegram authorization / allowlist checks still apply.

These are **volume** limits, not a financial ceiling. If an account can make 15 expensive requests, the provider can still charge for 15 expensive requests. Multiple accounts can reach the global limit. Telegram file types other than text and photos are unsupported by the capture parser.

## Provider-side hard spend cap — REQUIRED before public launch

1. Create a **dedicated OpenRouter API key** for Telegram capture. Do not reuse the key for SEO, imports or other AI workloads.
2. Set a per-key credit limit and a daily budget Guardrail, with a restricted model allowlist.
3. Pilot starting points: $5/day and $30/month, adjust after actual usage and forecast. These are example caps, not measured demand.
4. Confirm via OpenRouter Key API that `limit`, `limit_reset`, and `limit_remaining` are populated and not unlimited.
5. Confirm the app behaves gracefully on HTTP 402, 429, provider outages, and exhausted quota.
6. Monitor rejections and provider spend. Degrade to plain-text capture or retry-later, never silently bypass a spending cap with a different unlimited key.

## Measuring speed safely

The capture pipeline emits metadata-only logs:
- `[capture-prepare]`: time downloading Telegram images and preparing trusted family context
- `[capture-model]`: model, round-trip duration, parse result, input/output token counts for each call
- `[capture-processor]`: total time from PROCESSING claim to DRAFT_READY/FAILED
- `[capture-delivery]`: Telegram preview update duration

Use the same anonymous fixtures across both models: 10 direct short texts, 10 forwarded notices, 10 single screenshots, and 10 edit requests. Run in DEV only using a small-cost test key with its own spending ceiling. Record median, p95, valid schema rate, retries, and `tokensIn/out`. Do not log raw text, image bytes, chat IDs or API secrets. The integration test harness covers volume limits, not live model performance.

## Verification gates

- `pnpm test:telegram-capture`
- `pnpm test:telegram-capture-parser`
- `pnpm test:telegram-capture-integration` with a disposable migrated PostgreSQL database
- `pnpm check:push`
- Verify receiving >quota does not call the processor or OpenRouter.
- Verify two different users cannot jointly pass the global limit.
- Confirm normal 5–7 text captures/day remain accepted.

No deployment or live benchmark is implied by this document.
