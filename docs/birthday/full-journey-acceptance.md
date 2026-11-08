# Birthday constructor: reproducible full-journey acceptance

PR C is stacked on programme/family PR B #1178, which is stacked on isolated catalogue PR A #1175. No merge, deployment or live database writes are part of this task. Draft #1148 remains unmerged; its post-submission replacement integration is not substituted with a test-only mutation.

## Test boundaries

Use Node 22 and the guarded loopback database `127.0.0.1:55443/mamago_birthday_it`. Setup and manual authentication are documented in `demo-catalog.md`. Demo seed is idempotent and preserves manual edits. Existing `seedPartyIT.ts` creates separate IT fixtures for the established server integration suite; it never substitutes for manual catalogue accounts.

`pnpm test:birthday-journey:browser` uses an installed Chrome executable specified by `BIRTHDAY_CHROME_PATH`. It runs one browser journey at a time against `pnpm birthday:demo:start` at `127.0.0.1:34357`. No browser download, parallel workers, new production fixture API, auth/session injection or fabricated confirmation. Parent login and composition use real UI. Business responses and allocation use canonical services with demo business ownership. Only quote expiry is set directly as an isolated clock fixture. Browser contexts isolate accounts; cancellation/new-order is intentionally checked in the same context.

GitHub's existing birthday PostgreSQL job starts the isolated application only after server tests finish, then runs Chrome and uploads bounded PNG/JSON/log evidence for seven days. The local application runner passes an allowlist of environment values without email/SMS/Telegram credentials. No real messages are sent. Public link checks use an anonymous browser context and revoke the test capability afterward.

## Automated matrix

The executable report `artifacts/birthday-journey/results.json` records ID, expected result, actual result, PASS/FAIL/BLOCKED and screenshot evidence. A missing driver/browser or failed prerequisite is never reported PASS. Test source presence is not acceptance evidence. Final executed results and exact SHA belong in this document and the PR description after execution.

| ID | Data and actual actions | Expected result |
| --- | --- | --- |
| A | Studio, animator, cake, decor, photographer; controlled HTTP503; replace animator; remove/return photographer; reload; submit | Same server draft and remaining services, correct EXACT/FROM estimate, no loss on error, selected 14–16 time preserved |
| B | All-inclusive package in actual VENUE wizard; REQUIRED venue, no-refund cake, fixed-credit animator/photo, quote-required decor; replacement from another business | Mandatory component immutable, business credits apply once, snapshots/IDs survive reload, real package-change brief submitted |
| C-accept | Business proposes price; parent accepts in UI; business confirms actual BookingUnit twice | Price acceptance and booking separate; one confirmed allocation |
| C-reject | Parent rejects changed-package quote in UI | NEEDS_ALTERNATIVE; no resource or third-party replacement falsely confirmed |
| C-expiry-concurrency | Two owner PATCH at same version; expired quote opened in browser and acceptance retried via authenticated API | One 200/one409; expired quote cannot be accepted; no allocation |
| D-decline | Photo provider declines after venue confirmation | Confirmed anchor and its allocation preserved |
| D-replace | Choose provider alternative after submission | BLOCKED: existing audited replacement mutation is not integrated; Draft #1148 is unmerged |
| E | Select active adult/real child; save My Plan twice; second adult follows actual calendar deeplink | One PlanItem, explicit participants, read-only programme; private details unchanged |
| F | Enable anonymous link; read as guest; inspect noindex/redaction; revoke; reload | HTTP200 limited projection, then actualHTTP404; no personal/financial/contact data |
| G | Cancel unconfirmed package after rejected quote; rebuild in same session | Different draft ID; no resurrection of old requests or duplicate allocations |
| H-home / H-outdoor | Actual mobile-format wizard; edit package; reload | Saved request with truthful unsupported-submit guard; no forced PACKAGE state |
| H-package-change | Complete changed mobile-package submission | BLOCKED pending mobile package agreement contract |

Each interactive owner/review/family/public surface is checked at 320/375/390/768/1200 px where applicable. Screenshots are evidence of the executed state, not a claim that every possible device or p95 latency was measured.

## Defects fixed within C

- On-site VENUE wizard packages use the same package agreement contract as PACKAGE. A shared predicate protects UI/server parity; HOME/OUTDOOR remain guarded. Existing draft scope keys are unchanged to avoid a duplicate order or lost edits.
- StepReview reads authorized saved time, guest counts and contacts from PartyOrder once per draft/scope; a composition retry cannot overwrite unsaved inputs. These contact values are not stored in browser storage. Time inputs capture native input events and form fields stay disabled until hydration/restore.
- Reload keeps exact catalogue age filtering through an identity-free, date-bound month value in user/city-scoped session storage. No child name, ID or DOB is retained. Changing the party date invalidates the derived age instead of guessing a birthday. Live recipient data takes precedence.

## Efficient verification ledger

Focused tests/lint during implementation; one full push gate per finished exact SHA. New final-SHA GitHub CI is independent proof, not a reason for another identical local build. No parallel production builds or tests sharing the same database.

- Addressed date/age and package-scope unit assertions executed successfully.
- New VENUE package PostgreSQL regression plus existing four-policy/Decimal/snapshot/quote/allocation/replay cases passed on the guarded database. First attempt lacked separate `parent@it.test` fixtures; existing guarded IT seed supplied them before the focused rerun.
- Real local Chrome, authenticated demo parent: actual VENUE wizard, guest age8, selected package, reload with age10+ offers still filtered; mandatory component had no removal action. Replaced included animator with business2 service: package800 EXACT + separate FROM150 = minimum950. Removed no-refund cake without another reduction; requested decor exclusion changed package to ON_REQUEST with explicit agreement notice. Reload retained every component change and replacement. Submitted through the normal enabled VENUE agreement button, then reloaded order `cmw7ze8dc0001wsqiq6ttfox1`: same immutable request brief and actual14:00–16:00, no false third-party confirmation. Local PNG `/private/tmp/mamago-journey-package-{320,375,390,768,1200}.png`; all five content widths matched viewport. These are actual partial acceptance results, not a claim that the entire automated A–H matrix has already passed.
- Independent read-only review of C’s guards, restore/privacy and browser test boundaries: no confirmed P1/P2. Initial browser-driver type check caught an untyped role; corrected to PartyItemRole. Focused driver types/lint and six age/date units pass.
- The browser driver was refined against the real form: guest selection requires its explicit Выбрать action; after privacy-preserving reload, requested recipient fields must be entered before submit. Automatic CI execution and final gate/CI remain pending until their real results are recorded.

District compatibility and post-submission provider replacement remain explicit product dependencies, rather than invented test behaviour. No broad recommendation, booking or Family Core rewrite is included.
