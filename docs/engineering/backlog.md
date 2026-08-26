# mamaGo 2.0 Engineering Backlog

Единый источник инженерных задач, которые сознательно отложены на после
релиза или после более приоритетных задач.

Backlog **не заменяет**:

- `docs/migration/prelaunch-checklist.md` — то, что нужно довести до
  релиза/этапа (release blockers, текущий migration progress);
- release blockers;
- текущие active tasks.

Backlog хранит только deferred work / technical debt / cleanup / follow-up /
unresolved engineering decisions.

## Rules

1. Любая задача, сознательно отложенная на потом, должна быть добавлена сюда
   сразу.
2. Backlog не блокирует текущую разработку, если задача отдельно не помечена
   как release-critical.
3. Перед добавлением новой записи обязательно искать дубликат.
4. Перед возвратом к старой задаче проводить fresh audit текущего состояния —
   не доверять старой записи вслепую (SHA, branches, worktrees могли
   измениться).
5. Закрытые задачи не удалять: Status → DONE, добавить дату и commit/PR.
6. В backlog обязательно фиксировать причину, почему задача была отложена.
7. Если задача хранит уникальную работу в branch/worktree/commit — обязательно
   указывать exact ref (SHA, а не только имя ветки).
8. Разработка mamaGo ведётся последовательно: одна основная задача за раз.

## Статусы

```
OPEN         — зафиксирована, работа не начата
BLOCKED      — есть незакрытая зависимость
READY        — зависимости закрыты, можно брать в работу
IN_PROGRESS  — уже в работе
DONE         — закрыта, указана дата и commit/PR
DROPPED      — решили не делать, указана причина
```

## Приоритеты

```
P0 — critical / production / security
P1 — important after current release priorities
P2 — normal backlog
P3 — cleanup / polish / optional
```

## Шаблон записи

```
## [BACKLOG-XXX] Название

- Status:
- Priority:
- Area:
- Added:
- Reason deferred:
- Context:
- Current state:
- Dependencies:
- Acceptance criteria:
- Source:
```

---

## [BACKLOG-001] Resolve checkpoint-mask-fix vs checkpoint-mask-fix-v2

- Status: OPEN
- Priority: P1
- Area: Git / Migration
- Added: 2026-08-07
- Reason deferred: две независимо написанные реализации одного privacy-masked-user checkpoint guard существуют одновременно; ни одна не является надмножеством другой (разные сигнатуры функций, разные regex, разные guard-условия — доказано byte-level diff'ом во время аудита Category B worktrees). Это engineering/продуктовое решение, не подлежащее автоматическому выбору.
- Context: `mamago2-phoenix-checkpoint-mask-fix` (`797bd5f6`) реализует `isPrivacyMaskedUserNaturalKey(row)`, проверяет `targetRole`+`lastPlanAction`, свой regex, +2 docs файла. `mamago2-phoenix-checkpoint-mask-fix-v2` (`7b89d35b`) реализует `isUserMaskEmailPrivacyNaturalKey(type, key)`, более простая сигнатура, другой regex, без docs. Обе форкнуты от одного и того же коммита (`337fc5e6`).
- Current state: оба worktree всё ещё существуют: `mamago2-phoenix-checkpoint-mask-fix`, `mamago2-phoenix-checkpoint-mask-fix-v2`. Оба — B-category survivors, явно сохранены во время Git/worktree cleanup.
- Dependencies: нет блокирующих; требуется осознанное решение, какая реализация guard'а верна (или объединение свойств обеих).
- Acceptance criteria: выбрана (или объединена) одна реализация, влита в сторону `dev`, уникальные находки другого worktree зафиксированы или отброшены с обоснованием, оба worktree в итоге удалены.
- Source: audit (Category B Phoenix chain deep-dive)

## [BACKLOG-002] Integrate recovery/phoenix-pr102-rerun-skip

- Status: OPEN
- Priority: P1
- Area: Migration
- Added: 2026-08-07
- Reason deferred: worktree cleanup задача; branch создан исключительно как durable preservation anchor, ещё не проверен на mergeability относительно текущего `dev` (~42+ коммитов расхождения на момент создания anchor'а).
- Context: 18 уникальных Phoenix PR102 continuation коммитов (pinned offers-partial continuation, protected-Place adoption, rerun-skip handling, live-checkpoint foundation, Ratomka place data repair) — ни одного нет в `dev`/`origin/dev`, проверено patch-id sweep'ом.
- Current state: durable branch ref `recovery/phoenix-pr102-rerun-skip` → `c53d380cc4a244af863d4901d2873351cf119928`, хранится в общей `.git` директории (переживёт удаление worktree). Predecessor worktrees `mamago2-phoenix-pr102-integration` и `worktrees/phoenix-ratomka-place-repair` уже удалены (полностью сохранены как real/patch-equivalent ancestors). Worktree `mamago2-phoenix-pr102-rerun-skip` всё ещё существует (dirty только node_modules symlink + next-env.d.ts noise).
- Dependencies: зависит от решения BACKLOG-001 (checkpoint-mask-fix vs v2) в первую очередь, так как эта цепочка построена поверх реализации guard'а из checkpoint-mask-fix-v2.
- Acceptance criteria: цепочка проверена относительно текущего `dev`, rebased/reapplied по необходимости, влита или явно отклонена с обоснованием; worktree `mamago2-phoenix-pr102-rerun-skip` удалён после интеграции.
- Source: cleanup (Git/worktree Category B/C audit)

## [BACKLOG-003] Integrate recovery/admin-pagination

- Status: OPEN
- Priority: P1
- Area: Admin
- Added: 2026-08-07
- Reason deferred: восстановленный dirty WIP из устаревшего worktree; ещё не проверен/влит в `dev`, source worktree оставлен как страховка до подтверждения интеграции.
- Context: server-side pagination (`AdminPagination.tsx` + `src/lib/admin/pagination.ts`, уже закоммичены в `dev` как неиспользуемый dead code) подключена к ~46 admin list pages/services по всему `/admin/**`, заменяя жёсткие лимиты `take:100`.
- Current state: commit `48ddde837cb32277dcbca3cb6502849525e363aa` на ветке `recovery/admin-pagination`, все проверки зелёные (tsc, lint, build). Source worktree `mamago2-admin-pagination` осознанно оставлен dirty/нетронутым (обычный `git worktree remove` был отклонён Git'ом, так как worktree dirty; `--force` не использовался).
- Dependencies: нет блокирующих.
- Acceptance criteria: recovery branch влит в `dev` (или заменён более чистой реализацией), source worktree `mamago2-admin-pagination` удалён после подтверждения.
- Source: cleanup (Category C worktree audit — admin-pagination dirty WIP recovery)

## [BACKLOG-004] Integrate recovery/plan-suggestions-age-tags-null

- Status: OPEN
- Priority: P2
- Area: My Plan / Backend
- Added: 2026-08-07
- Reason deferred: восстановлен небольшой bugfix из устаревшего worktree; ещё не влит, требуется стандартный review/merge flow.
- Context: Prisma-фильтр `ageTags` использовал только `equals: []`, что не матчит SQL `NULL` — активности без возрастных тегов молча исключались из подборки "без возрастных ограничений" при активном возрастном фильтре. На момент recovery подтверждено, что баг всё ещё присутствует в `dev`.
- Current state: commit `663e2539092f2a021fe030f06bddbca6142cece4` на ветке `recovery/plan-suggestions-age-tags-null`. Все проверки зелёные (tsc, lint, build; выделенного теста для этого файла нет).
- Dependencies: нет.
- Acceptance criteria: влит в `dev`, dirty diff для этого файла в source worktree `.claude/worktrees/wizardly-rosalind-c36294` отброшен/worktree удалён после интеграции.
- Source: cleanup (Category C worktree audit — wizardly-rosalind-c36294 dirty WIP recovery)

## [BACKLOG-005] Integrate recovery/article-inline-media-public-access

- Status: OPEN
- Priority: P2
- Area: Media / Articles
- Added: 2026-08-07
- Reason deferred: восстановлена 3-коммитная цепочка функциональности из устаревшего worktree; ещё не влита.
- Context: публичный доступ к inline media опубликованных статей, article content usage sync, выравнивание usage-tracking с `dev` (один predecessor-коммит, `51b5b4d6`, уже приземлился независимо в `origin/dev`; recovery реплеит два действительно уникальных коммита плюс этот общий, разрешая один тривиальный конфликт порядка scripts в `package.json`).
- Current state: branch `recovery/article-inline-media-public-access`, HEAD `e2edfe4dedfbbe780fd257df7b50b24677c00af2`. Все проверки зелёные (tsc, lint, целевые тесты, build). Source worktree `.claude/worktrees/agent-afb427503fa2ade7a` уже удалён (подтверждён clean, preservation proof проверен свежим прямо перед удалением).
- Dependencies: нет блокирующих.
- Acceptance criteria: влит в `dev`.
- Source: cleanup (Category C worktree audit — agent-afb427503fa2ade7a recovery)

## [BACKLOG-006] Remove legacy source worktrees after recovery branches are integrated

- Status: OPEN
- Priority: P2
- Area: Git
- Added: 2026-08-07
- Reason deferred: удаление должно ждать подтверждённой интеграции/merge каждой соответствующей recovery-ветки (BACKLOG-002 — BACKLOG-005) — удаление source раньше рискует потерей единственной копии, если recovery branch окажется неполной.
- Context: несколько source worktrees намеренно оставлены как страховка после создания recovery-веток (`mamago2-admin-pagination`, `mamago2-phoenix-pr102-rerun-skip`; у `.claude/worktrees/vigilant-bhaskara-655489` — отдельный частичный recovery, см. BACKLOG-004 и сам worktree).
- Current state: worktrees всё ещё присутствуют, ни один не удалён преждевременно.
- Dependencies: BACKLOG-002, BACKLOG-003, BACKLOG-004, BACKLOG-005.
- Acceptance criteria: для каждого — свежий read-only аудит, подтверждающий, что recovery branch влита/заменена, затем `git worktree remove` (без `--force`) для каждого source worktree.
- Source: cleanup (Git/worktree Category B/C cleanup)

## [BACKLOG-007] Review mamago2-local-wip docs-only residue

- Status: OPEN
- Priority: P3
- Area: Migration / Docs
- Added: 2026-08-07
- Reason deferred: низкая ценность, нет срочности — основная часть 18 коммитов этого worktree (16 из 18, плюс полный агрегированный checkpoint-коммит) доказанно patch-equivalent уже в `dev` через полный patch-id sweep; уникальным остался только один небольшой docs-коммит.
- Context: commit `104b847f5bae3348a3a231f478584ef4eb8e849f` ("docs(migration): record masked User lineage checkpoint blocker") документирует read-only аудит той же проблемы masked-User-key checkpoint, о которой BACKLOG-001 (75 групп дублей, 462 строки, root-cause анализ) — подтверждено отсутствие в `dev`, `origin/dev` и в docs B-survivor'ов checkpoint-mask-fix.
- Current state: worktree `mamago2-local-wip` всё ещё существует, нетронут, clean.
- Dependencies: слабо связано с BACKLOG-001 (та же исходная проблема) — имеет смысл решать вместе.
- Acceptance criteria: решить, переносить ли docs-заметку в `prelaunch-checklist.md` или в релевантный migration-документ; после этого worktree `mamago2-local-wip` можно удалить.
- Source: audit (Category C worktree audit — local-wip patch-id sweep)

## [BACKLOG-008] Establish permanent worktree lifecycle policy

- Status: OPEN
- Priority: P2
- Area: Git / Process
- Added: 2026-08-07
- Reason deferred: улучшение процесса/тулинга, не срочно относительно релизной работы; но объём устаревших worktrees, найденный в этой уборке (49 на старте, многие — месяцами, несколько с работой под риском потери), показывает, что текущий ad-hoc подход не масштабируется.
- Context: исходный аудит нашёл 49 worktrees, накопленных за время жизни проекта, несколько — с содержательной незакоммиченной или невлитой работой, которую пришлось вручную спасать.
- Current state: сейчас нет политики, кроме раздела Git/Worktree Safety в `CLAUDE.md` (покрывает безопасное использование, а не lifecycle/периодичность уборки).
- Dependencies: нет.
- Acceptance criteria: написанная политика (например, в `CLAUDE.md` или отдельном документе), покрывающая: temporary worktree → task → checks → commit/PR → verify preservation → remove; норму против создания параллельных worktrees без необходимости; согласованную периодичность/триггер для регулярных аудитов worktrees.
- Source: cleanup (full Git/worktree cleanup project, 2026-08-07)

## [BACKLOG-009] Post-release branch/worktree hygiene audit

- Status: OPEN
- Priority: P3
- Area: Git
- Added: 2026-08-07
- Reason deferred: не release-critical; намеренно запланировано на после production cutover, чтобы ничего не трогать в разгар релиза.
- Context: в ходе этой уборки обнаружено расхождение `dev` и `origin/dev` (по 2 уникальных коммита с каждой стороны); у многих веток теперь нет соответствующего worktree после уборки (удаления Category A/B/C) и их стоит со временем удалить после подтверждения merge/заброшенности.
- Current state: ни одна ветка не была удалена ни на одном из шагов этой уборки (0 branches deleted за весь cleanup) — это намеренно оставлено отдельной будущей задачей.
- Dependencies: production cutover / завершение релиза; расхождение `dev` vs `origin/dev`, вероятно, стоит сначала устранить (не часть этого backlog item, но вероятный prerequisite).
- Acceptance criteria: свежий read-only аудит всех оставшихся branch refs, классификация merged/stale/active, удаление только доказанно безопасного (никогда по имени или возрасту в одиночку), отчёт до любого удаления.
- Source: cleanup (full Git/worktree cleanup project, 2026-08-07)

## [BACKLOG-010] Integrate/preserve mamago2-rate-limit

- Status: OPEN
- Priority: P2
- Area: Security / Backend
- Added: 2026-08-07
- Reason deferred: уникальная невлитая реализация persistent rate limiting; сознательно отложена — не release-critical сама по себе, требует обычного review/merge flow.
- Context: `mamago2-rate-limit` содержит persistent rate-limit entries (Prisma model + `rateLimit.ts`) поверх auth/notifications/direct-messages/bookings endpoints. Во время Category B аудита доказано patch-id sweep'ом, что cumulative work отсутствует и в `dev`, и в `origin/dev`. Является B-survivor (сознательно сохранён во время Git/worktree cleanup, не удалён).
- Current state: worktree `mamago2-rate-limit` существует, clean, HEAD не в `dev`/`origin/dev`.
- Dependencies: нет.
- Acceptance criteria: работа проверена относительно текущего `dev`, влита (или переписана заново при необходимости адаптации к drift), worktree удалён после подтверждённой интеграции.
- Source: cleanup (Category B Phoenix/duplicate-family audit)

## [BACKLOG-011] Integrate/preserve mamago2-wp-legacy

- Status: OPEN
- Priority: P2
- Area: SEO / Routing
- Added: 2026-08-07
- Reason deferred: уникальная невлитая реализация WP legacy catch-all редиректов; сознательно отложена, требует обычного review/merge flow.
- Context: `mamago2-wp-legacy` содержит WP legacy catch-all redirect middleware + `wp-redirect-map.json` + validation script. Во время Category B аудита доказано patch-id sweep'ом, что работа отсутствует и в `dev`, и в `origin/dev`. Является B-survivor (сознательно сохранён во время Git/worktree cleanup, не удалён).
- Current state: worktree `mamago2-wp-legacy` существует, clean, HEAD не в `dev`/`origin/dev`.
- Dependencies: нет.
- Acceptance criteria: работа проверена относительно текущего `dev`, влита (или переписана заново при необходимости адаптации к drift), worktree удалён после подтверждённой интеграции. Не терять branch/worktree до этого момента.
- Source: cleanup (Category B Phoenix/duplicate-family audit)

## [BACKLOG-012] Review/integrate mamago2-phoenix-checklist

- Status: OPEN
- Priority: P1
- Area: Migration
- Added: 2026-08-07
- Reason deferred: крупный независимый массив работы (~28 уникальных коммитов), требует отдельного осознанного review перед интеграцией — не merge-ready без отдельного fresh audit.
- Context: `mamago2-phoenix-checklist` — независимая Phoenix lineage (форкнута от `de94f716`, уже содержащегося в `dev`), реализует seven-phase Phoenix release bundle: per-entity release adapters, golden-proof scripts, stories rail data layer. Доказано ancestor-проверкой, что это **не** successor PR102 chain (см. BACKLOG-002) — общий предок далеко в истории, отдельная ветка разработки. Является B-survivor (сознательно сохранён во время Git/worktree cleanup, не удалён).
- Current state: worktree `mamago2-phoenix-checklist` существует, clean, HEAD не в `dev`/`origin/dev`. Частично пересекается по файлам с PR102/checkpoint-mask-fix chain (`registry.ts`, `coordinator.ts`, `migration-phoenix-release.ts`, `prelaunch-checklist.md`) — риск конфликтов при совместной интеграции.
- Dependencies: желательно решить BACKLOG-001/BACKLOG-002 первыми ради согласованности пересекающихся файлов, но формально не блокирует.
- Acceptance criteria: свежий read-only аудит текущего состояния перед любой интеграцией, оценка конфликтов с пересекающимися файлами, влито или явно отклонено с обоснованием.
- Source: audit (Category B Phoenix chain deep-dive)

## [BACKLOG-013] Integrate recovery/remove-legacy-plan-suggestions

- Status: OPEN
- Priority: P2
- Area: My Plan / Frontend
- Added: 2026-08-07
- Reason deferred: восстановленный dead-code cleanup из устаревшего worktree, адаптирован вручную под текущий `dev`; ещё не влит, требует обычного review/merge flow.
- Context: удаляет устаревший hook-level suggestions plumbing (`planSuggestions`, `suggestionsLoading`, `refetchPlanSuggestions`, `planSuggestionExcludeSignature`, `selectedAgeRangesKey`) из `useMyPlan.tsx`/`MyPlanPanelContent.tsx`/`PlanMainContent.tsx` — подтверждено как dead code (ESLint уже фиксировал `planSuggestions`/`suggestionsLoading` как unused в `dev` до этого изменения). Новый recommendations flow (`lib/fetchPlanSuggestions()` + local component state) остаётся полностью нетронутым.
- Current state: commit `cc6404a4ca3f3a382bdecd73ddeb5ccfe04f5422` на ветке `recovery/remove-legacy-plan-suggestions`. Все проверки зелёные (targeted tests, tsc, lint, build). Source worktree `.claude/worktrees/vigilant-bhaskara-655489` пока не удалён и не изменён — можно удалять только после подтверждённой интеграции/сохранности этой recovery-ветки.
- Dependencies: нет блокирующих.
- Acceptance criteria: влит в `dev`; после подтверждения — source worktree `.claude/worktrees/vigilant-bhaskara-655489` удалён (его отдельный committed HEAD, старый merge-коммит, уже superseded через PR #30 в `dev` — сам по себе не требует отдельной интеграции).
- Source: cleanup (Category C worktree audit — vigilant-bhaskara-655489 dirty WIP recovery)

## [BACKLOG-014] Review/cleanup analytics-truth-worktree

- Status: OPEN
- Priority: P3
- Area: Git / Analytics
- Added: 2026-08-07
- Reason deferred: worktree принадлежит другой (не этой) Claude session — cleanup сознательно отложен до подтверждения, что та session завершена, чтобы не выдернуть рабочее дерево из-под активной параллельной работы.
- Context: `analytics-truth-worktree` (branch `feat-analytics-truth-foundation`) на момент аудита имел HEAD, совпадающий с `origin/dev` (`ad0a610d`) — то есть без собственной уникальной работы; dirty-состояние ограничивалось шумом (`node_modules`). Расположен в scratchpad-директории другой сессии (`/private/tmp/claude-501/.../b94ea3f4-e71c-4f84-8da8-0d466d4be312/...`), не в основном dev-дереве.
- Current state: worktree не тронут; принадлежность другой активной/неактивной session не подтверждалась повторно с момента первого аудита.
- Dependencies: подтверждение, что владеющая session завершена/неактивна.
- Acceptance criteria: fresh read-only аудит непосредственно перед любым действием (HEAD, dirty-состояние, process/session liveness); удаление worktree только после этого и только обычным `git worktree remove` (без `--force`).
- Source: audit (Category C worktree audit — analytics-truth-worktree)

## [BACKLOG-015] Offer media (cover/gallery) — implement real importer

- Status: DONE (2026-08-14)
- Priority: P1
- Area: Media / Offers
- Added: 2026-08-07
- Reason deferred: explicit founder decision (`docs/migration/prelaunch-checklist.md`
  line 1040, applied 2026-07-29): "Offer media Option B, explicit P1 defer" —
  approved only after fixing a real defect (broken 49-byte `og-default.jpg`
  placeholder replaced with a real 1200×630 JPEG), so all 63 PUBLISHED
  Offers currently render cleanly via existing fallbacks (card: placeholder
  pattern in `OfferCard.tsx`; detail hero/OG: `og-default.jpg` via
  `src/lib/media/mapOfferPageMedia.ts`) — not a broken-image state.
- Context: `Offer.coverImage`/`galleryImages` are plain string/JSON fields,
  no `OfferImage` relational table (unlike `PlaceImage`). No delegate exists
  for `OfferMediaSyncer`; `scripts/migration-commit-wordpress-db.ts` hard-
  blocks `--entity offer --media-policy FULL` in code (line 261). Building a
  real importer means designing a storage/dedup model (mirroring
  `PlaceMediaSyncer`) — a genuinely new, scoped piece of architecture, not a
  Task 1 (DEV media import) minimal-scope fix. Confirmed via DEV DB
  read-only audit 2026-08-07: 0/63 Offers (all PUBLISHED) have any image.
- Current state: DONE. `FullOfferMediaDelegate` reuses MediaImportWriter +
  attachment lineage. CLI no longer hard-blocks `--entity offer
  --media-policy FULL`. One broken attachment does not abort the Offer
  commit. Media attaches on CREATE.
- Dependencies: none blocking.
- Acceptance criteria: founder chooses Option A (minimal source-backed
  cover-image importer reusing `PlaceMediaSyncer`'s dedup/storage pattern)
  or reconfirms Option B indefinitely; if A, implement + verify idempotency
  + verify no broken images regression.
- Source: `docs/release/dev-to-prod-checklist.md` Task 1 audit (Import
  Images Into DEV)

## [BACKLOG-016] Place FULL media backfill blocked — TARGET_MODIFIED_AFTER_IMPORT

- Status: DONE (2026-08-07, commit `32be8beb`)
- Priority: P1
- Area: Migration / Media / Places
- Added: 2026-08-07
- Reason deferred: real, systemic safety-gate block discovered while
  executing Task 1's approved write phase — not something to bypass
  unilaterally; the tool's own error says "needs manual reconciliation — no
  automatic override exists."
- Context: `classifyPlaceUpdateSafety()`
  (`src/lib/migration/commit/place/classifyPlaceUpdateSafety.ts:84`) refuses
  any Place UPDATE (and, since media sync only runs after a successful
  UPDATE/CREATE in `PlaceCommitRunner.execute()`, therefore also refuses
  media sync) whenever `Place.updatedAt > MigrationLineage.lastImportedAt`.
  The 2026-07-29 mass Place publication session
  (`prelaunch-checklist.md`, "canonical-table (76 unconditional UPDATEs) and
  search-index (76 unconditional upserts) writes did occur, value-neutral
  (timestamp-only)") bumped `updatedAt` on essentially every published
  Place, so this now fires for the entire remaining corpus — confirmed by
  testing `--force-reprocess --media-policy FULL` on 3 separate clean
  source keys (`wordpress-db:places:5457/5492/5515`), all three failed
  identically with `PLACE_UPDATE_CONFLICT: TARGET_MODIFIED_AFTER_IMPORT`.
  Net effect: 68 of 78 clean Places (with real source media evidence) could
  not be backfilled this session; Place gallery coverage stayed at 5/83
  (only the pre-existing sample + 1 partial). No code change was attempted
  to bypass this — that would risk exactly the "silent overwrite of a
  possibly-manually-edited record" this gate exists to prevent.
- Current state: not started. 0 Places touched by this session's Place
  media attempts (confirmed via unchanged `PlaceImage` row count, 51,
  before/after).
- Dependencies: founder decision on how to safely reconcile — options
  include (a) a one-off script that resyncs `MigrationLineage.lastImportedAt`
  to "now" for records confirmed value-neutral-touched-only (requires
  auditing each of the 78 to rule out real manual edits), (b) a smarter
  content-hash-based conflict check for Place mirroring the
  hash-equality approach `strictEventMediaReplay.ts`/
  `strictArticleMediaReplay.ts` already use successfully (real but scoped
  new code), or (c) accept current Place media coverage as the DEV
  baseline and revisit at PROD cutover time (Place production media import
  is separately still `GATED` per `prelaunch-checklist.md`).
- Acceptance criteria: founder picks an option; if (a) or (b), implement,
  verify idempotency, re-run against the remaining clean Place corpus.
- Resolution: chose a narrower variant of option (b) — instead of loosening
  `classifyPlaceUpdateSafety()`'s timestamp check itself (kept fully
  intact, still protects the real content-commit path), added a separate,
  explicit `--force-place-media-replay` CLI path
  (`src/lib/migration/runtime/placeMediaOnlyReplay.ts`) that calls
  `PlaceMediaSyncer.sync()` directly, bypassing the conflict gate
  entirely — safe by construction because `PlaceMediaSyncer` never writes
  to the `Place` row itself (only `PlaceImage`/`MediaAsset`/
  `MigrationLineage(MEDIA_ASSET)`), confirmed both by reading the class
  and empirically (byte-identical `Place` row diff, including
  `updatedAt`, before/after on golden-proof + full-batch runs). Ran
  against all 68 clean Place source keys with real source media: 61
  applied (new imports) + 7 already-synced (`NOOP_ALREADY_SYNCED`), 0
  refused, 0 failed. Place gallery coverage: 5/83 → 68/83. The remaining
  15 either have no media in the WP source at all, or are the 1
  non-WP-origin Place — not a gap this mechanism can or should close.
- Source: `docs/release/dev-to-prod-checklist.md` Task 1 write-phase
  execution (Import Images Into DEV)

## [BACKLOG-017] Route/RouteStop media has no safe narrow replay path

- Status: OPEN
- Priority: P2
- Area: Migration / Media / Routes
- Added: 2026-08-07
- Reason deferred: not attempted this session — real, unverified risk found
  during Task 1's audit, not a quick fix.
- Context: unlike Event (`--force-media-reprocess`, hash-equality gated,
  proven safe this session) and Article (`--force-article-media-replay`,
  same hash-equality gate, proven safe this session), Route has no dedicated
  narrow media-only replay CLI path — `RouteStopMediaSyncer`/
  `MediaPolicyGatedRouteStopMediaSyncer` are only reachable through the
  generic `RouteCommitRunner` UPDATE path. A `TARGET_MODIFIED_AFTER_IMPORT`
  timestamp gate now exists (`classifyImportedTargetUpdateSafety`). FULL
  first-run RouteStop media remains wired via `MediaPolicyGatedRouteStopMediaSyncer`.
  Narrow media-only replay (`--force-route-media-replay`) is still absent.
  `--entity route --media-policy FULL` run would therefore UPDATE every
  matched Route's content fields unconditionally, with no protection
  against clobbering a manual edit made since import. Separately, the
  read-only preview CLI (`migration-preview-wordpress-db.ts`) only wires its
  ledger lookup for `--entity place` (`includesPlacePreview()` gate,
  confirmed by reading the file) — so `--entity route`/`--entity article`
  preview output showing `action: CREATE` for already-imported records is a
  **preview-tool-only blind spot**, not evidence of the commit script's real
  behavior (the commit script wires `MigrationLedgerRepository`
  unconditionally for every entity) — worth fixing for future migration
  sessions so preview output isn't misleading, but not itself a blocker.
- Current state: FULL first-run RouteStop media is wired, including
  `RouteStopImage` galleries (BACKLOG-112 DONE). Timestamp update-safety
  exists. Narrow `--force-route-media-replay` is still absent (recovery
  tool, not first-run). Cover mapping landed 2026-08-14:
  WP `_thumbnail_id` → existing `Route.coverImageUrl` via MediaAsset
  lineage. PROD still has 0/14 covers and no `RouteStopImage` rows until
  an owner-controlled Prisma migrate + Route-only rerun. Replay CLI
  remains the recovery tool.
- Dependencies: needs either (a) a `classifyRouteUpdateSafety`-equivalent
  guard added to `RouteCommitRunner` (mirroring Place), or (b) a dedicated
  `--force-route-media-replay` narrow path (mirroring Event/Article) before
  any Route media backfill is safe to run.
- Acceptance criteria: safety net built and verified; then Route/RouteStop
  media backfill can run safely.
- Severity review (2026-08-07, Task 1 closure): replay tool confirmed
  **not** P0/P1 for first PROD. 2026-08-14: extra stop images moved to
  BACKLOG-112 and implemented (`RouteStopImage`). This entry stays P2 for
  the missing `--force-route-media-replay` recovery path only.
- Source: `docs/release/dev-to-prod-checklist.md` Task 1 audit (Import
  Images Into DEV)

## [BACKLOG-018] Local dev database/storage is not the real DEV target — no documented safe access path

- Status: DONE (2026-08-07 — actual DEV access path proven and used for Task 1)
- Priority: P0 (resolved)
- Area: Migration / Environment / Process
- Added: 2026-08-07
- Context: Earlier Task 1 write session targeted local Docker Postgres
  (`localhost:5433` / `mamago2-db`) and local `storage/uploads/`, which are
  **not** `https://dev.mamago.by`. Owner correctly reported missing media in
  actual DEV.
- Resolution: Real DEV lives on physical host `134.17.17.134` (`ubuntu`)
  alongside an isolated PROD stack. Mapping proven read-only then used for
  writes: Traefik `Host(dev.mamago.by…)` → `dev-app-1`; DB `dev-db-1` /
  `devmamago` / volume `dev_db_dev_data`; storage volume
  `dev_mamago2_storage` → `/app/storage`. Safe agent path used without
  deploying the app: SSH + local tunnel to DEV Postgres + local
  `MEDIA_STORAGE_ROOT` staging synced **only** into `dev_mamago2_storage`
  (never `prod_*`). WP source remains `134.17.16.78` from the Mac (DEV host
  cannot TCP to WP:22). Note: this Mac's SSH alias `mamago-prod` still
  points at the DEV IP — rename is a remaining hygiene item, not a blocker
  once Traefik/compose identity is verified before any write.
- Acceptance criteria: met via Task 1 ACTUAL DEV verification in
  `docs/release/dev-to-prod-checklist.md`.
- Source: Task 1 environment reconciliation + actual-DEV media import session

## [BACKLOG-019] DEV Events with null cityId not reachable on /{city}/events/{slug}

- Status: OPEN
- Priority: P2
- Area: Content / Events / Routing
- Added: 2026-08-07
- Reason deferred: does not block first PROD readiness of media dataset;
  Place galleries (core Task 1 surface) already smoke green on actual DEV.
  Event cover MediaAssets import and serve 200; city-scoped public page
  returns "Событие не найдено" when `Activity.cityId` is null.
- Context: Observed on actual `devmamago` after Task 1 media import
  (e.g. `immersivnaya-vystavka-neboreka-planeta-posle-shuma`). Pre-existing
  data/routing gap, not introduced by the media importer.
- Acceptance criteria: published Events used for public DEV testing have a
  resolvable city binding (or public route tolerates null city safely).
- Source: Task 1 actual-DEV browser smoke

## [BACKLOG-020] Duplicate active PLACE lineage for wordpress-db:places:5457

- Status: OPEN
- Priority: P2
- Area: Migration / Places / Lineage
- Added: 2026-08-07
- Reason deferred: only one source key; media replay uses `findFirst` and
  would be non-deterministic. Skipped during Task 1 actual-DEV import
  rather than risk wrong Place. Does not block overall DEV media dataset.
- Context: Two active `MigrationLineage` PLACE rows for the same
  `sourceRecordKey`, targeting two Place rows that share slug
  `kofta-na-pr-t-mira-1`.
- Acceptance criteria: one active lineage (or explicit disambiguation
  rule) before media replay for that key.
- Source: Task 1 actual-DEV Place batch

## [BACKLOG-021] Orphan migrated MediaAssets without entity linkage

- Status: OPEN
- Priority: P2
- Area: Migration / Media metadata
- Added: 2026-08-08
- Reason deferred: after Task 1 metadata backfill, ~356/1055 MIGRATED
  assets still have no PlaceImage / Activity cover|gallery / Article
  cover|seo|contentJson link. Inventing titles/alt without entity context
  would violate the no-keyword-stuffing policy. Does not block visual
  smoke of linked Place/Event/Article media.
- Context: Owner-visible library names like `IMG_4888`, `DSC_9765`,
  `10793767_0` are often these orphans — `originalName`/attachment lineage
  intact, but no discoverable mamaGo entity. Likely WP attachments imported
  for articles that stayed PENDING / refused content replay, or unused
  gallery members.
- Acceptance criteria: resolve parent entity via WP `post_parent` (or
  drop/archive truly unused attachments) then run the same idempotent
  metadata backfill; still never overwrite curated metadata.
- Source: Task 1 media metadata audit/backfill follow-up

## [BACKLOG-022] Search: no transliteration / keyboard-layout / typo tolerance

- Status: OPEN
- Priority: P2
- Area: Search
- Added: 2026-08-08
- Reason deferred: confirmed real via a representative golden-set evaluation
  against real DEV data (`https://dev.mamago.by`), but Task 2's own scope
  guardrails explicitly say not to build a fuzzy-matching engine without
  proven necessity, and there is no real user query-volume evidence yet
  (pre-PROD, `SearchQueryLog` traffic so far is test/agent-generated, not
  organic) that this is frequent enough to justify new infrastructure now.
- Context: `/api/search` matches via plain Postgres `ILIKE`-style `contains`
  on `SearchDocument.searchText` (built by `src/lib/search/sanitizeSearchText.ts`,
  which only strips HTML/collapses whitespace). No transliteration
  (RU↔LAT), no wrong-keyboard-layout correction, no fuzzy/typo tolerance,
  no `pg_trgm` anywhere in the repo. Reproduced on real DEV: `q=театр` → 8
  relevant results; `q=teatr` (transliteration) → 0; `q=ntfnh` (same word
  typed on the wrong keyboard layout) → 0; `q=театор` (one-letter typo) →
  0; `q=мулберри` (alternate transliteration of an existing "Малберри
  Клаб") → 0.
- Current state: not started. `SearchSynonym` (Prisma model + full
  `/admin/search/synonyms` CRUD UI) already exists and could serve as the
  first, cheapest mitigation (admin manually maps a known bad spelling to
  the correct term) but is not currently consulted by `/api/search/route.ts`
  — see BACKLOG-024.
- Dependencies: none blocking. `/admin/search/zero-results` (live) is the
  right place to observe whether this is a real, frequent problem once
  organic PROD traffic exists.
- Acceptance criteria: once real zero-result query volume shows this
  matters, either (a) wire `SearchSynonym` into the query path (cheapest,
  fully reuses existing admin UI), or (b) add a small deterministic
  RU↔LAT keyboard-layout remap as a fallback query, or (c) add `pg_trgm` +
  a GIN index for real fuzzy matching if volume justifies the new
  infrastructure. Do not build (c) speculatively.
- Source: `docs/release/dev-to-prod-checklist.md` Task 2 audit (Search
  Ranking) — golden-set DEV evaluation

## [BACKLOG-023] Search admin: hardcoded mock stats on `/admin/search` overview

- Status: OPEN
- Priority: P2
- Area: Search / Admin
- Added: 2026-08-08
- Reason deferred: misleading but not unsafe — doesn't affect production
  search or ranking behavior, purely a display issue on an internal admin
  page.
- Context: `src/app/admin/search/page.tsx` renders hardcoded mock arrays
  (e.g. `"Searches Today": "12,847"`) instead of real `SearchQueryLog`
  aggregates, and a "Popular Queries" table that is also mock data. An
  admin reading this page today sees fabricated numbers with no visual
  indication they're fake.
- Current state: not started. The real data source (`SearchQueryLog`) is
  live and already has a working query pattern to copy from
  `src/app/api/admin/search/zero-results/route.ts`.
- Dependencies: none.
- Acceptance criteria: either wire the tiles/table to real
  `SearchQueryLog` aggregates, or remove the page/mark it clearly as a
  placeholder, so admins never see fabricated numbers presented as real.
- Source: `docs/release/dev-to-prod-checklist.md` Task 2 audit (Search
  Ranking)

## [BACKLOG-024] Search: dead/unused search-adjacent infrastructure cleanup

- Status: OPEN
- Priority: P3
- Area: Search
- Added: 2026-08-08
- Reason deferred: none of this is broken or unsafe in production today —
  it's inert scaffolding that doesn't affect the live search path
  (`SearchDocument` / `/api/search`). Pure cleanup, no release risk.
- Context (confirmed via code read, each independently, 2026-08):
  - `SearchIndexRecord` model + `src/lib/search/indexManager.ts` +
    `/admin/search/index` health dashboard — nothing in the live write path
    populates `SearchIndexRecord` (the real index is `SearchDocument`, kept
    current by `SearchIndexerService`/`prismaSearchExtension.ts`), so the
    dashboard reads a table that stays empty/stale forever despite the real
    index being fully populated and correct.
  - `SearchQuickTag` (full CRUD UI at `/admin/search/quick-tags`) has no
    public consumer — `src/lib/search/popularSearchTags.ts`'s
    `resolveVisiblePopularTags()` uses a separate hardcoded candidate list
    gated on real counts that are never supplied (`SearchResults.tsx`
    always calls it with an empty counts map), so the "Популярное" block is
    permanently hidden in production regardless of `SearchQuickTag` state.
  - `SearchSynonym` (full CRUD UI at `/admin/search/synonyms`) is not read
    by `/api/search/route.ts` — admin-entered synonyms currently have zero
    runtime effect. (Wiring this one in is the actionable option tracked
    separately in BACKLOG-022, not pure cleanup.)
  - `src/app/api/search/debug/route.ts` carries its own
    `TODO: remove or restrict before production hardening` comment; already
    gated by `requireAdminOrModeratorApiUser()` and returns 404 outside
    `NODE_ENV=production`, so not unsafe as-is, just dead weight.
  - `RankingSettings`/`BoostSettings` (`/admin/ranking/weights`,
    `/admin/ranking/boost`) and the separately-modeled `SearchRankingSettings`
    (`/admin/search/ranking`) are two independently-built, differently-shaped
    ranking-weight admin panels; a prior 2026-08 audit (code comments in
    `src/server/services/ranking/adminRankingHandlers.ts` and
    `src/server/services/search/adminSearchRankingHandlers.ts`) already
    found neither is read by production ranking and locked both to
    read-only (mutations return 403) — correctly prevents admin from
    silently believing they affect ranking. Confirmed still in that state.
    Picking one design (or a real one) and deleting the other is the
    eventual cleanup; not urgent since both are already inert and clearly
    labeled read-only in the UI.
- Current state: not started.
- Dependencies: none blocking each other; can be tackled independently.
- Acceptance criteria: for each item, either wire it to something real or
  delete it — do not leave dead admin UI surfaces that look functional but
  aren't.
- Source: `docs/release/dev-to-prod-checklist.md` Task 2 audit (Search
  Ranking)

## [BACKLOG-025] Search: `logSearchClick()` has no confirmed caller

- Status: OPEN
- Priority: P2
- Area: Search / Analytics
- Added: 2026-08-08
- Reason deferred: click-through tracking is an analytics/ranking-signal
  concern that belongs to Task 3 (Publication Analytics) / Task 5 (Content
  Analytics & Ranking), not Task 2's core exit criteria (Task 2 only
  requires zero-result demand to be detectable, which already works via
  `SearchQueryLog`/`resultsCount=0`).
- Context: `src/lib/search/logSearchQuery.ts` exports `logSearchClick()` to
  backfill `SearchQueryLog.clickedEntityId` when a user clicks a search
  result, but no caller was found anywhere in `src/` in this audit pass.
  Search click-through data is therefore not actually being collected
  today, even though the schema/plumbing exists.
- Current state: not started.
- Dependencies: best picked up alongside Task 3/5 (shared analytics/signal
  layer), not in isolation.
- Acceptance criteria: either wire `logSearchClick()` into the actual
  result-click handler (`SearchResultItem.tsx` / mobile equivalents) or
  remove the dead export, decided together with Task 3/5 scope.
- Source: `docs/release/dev-to-prod-checklist.md` Task 2 audit (Search
  Ranking)

## [BACKLOG-026] Content Performance "Open %" misleading for entity types without impression tracking

- Status: RESOLVED (2026-08-09)
- Priority: P2
- Area: Analytics / Admin
- Added: 2026-08-08
- Resolution: Task 3 MVP publication-analytics-drill-down follow-up made
  two changes together: (1) `openRate`/`saveRate`/`planRate`/
  `clickRateVsOpens`/`clickRateVsPlans` on `ContentPerformanceEntityRow`/
  `ContentPerformanceComparisonRow` are now `number | null` — `null`
  whenever the real denominator is 0, rendered as `—` (not a fake `0.0%`)
  by `pct()` in `AdminAnalyticsContentPerformance.tsx` and the new
  publication drill-down; (2) `CARD_VIEW` impression tracking was wired
  onto the real Offer (`[city]/programs/page.tsx`, homepage "Занятия" row)
  and Article (`/blog` journal index, homepage "Статьи и обзоры" row)
  discovery surfaces, closing the "no impressions tracked at all" root
  cause for those two types (see BACKLOG-032). Place still has no public
  listing/catalog surface at all (confirmed by routing audit — remains
  open, see BACKLOG-032), so Place's `views`/`openRate` stay legitimately
  `0`/`—` until such a surface exists — now correctly rendered as `—`
  instead of a misleading `0.0%`.
- Source: `docs/release/dev-to-prod-checklist.md` Task 3 audit
  (Publication Analytics) + MVP drill-down follow-up

## [BACKLOG-027] `Article.views` is a second, uncorrelated view counter parallel to `UserEvent`

- Status: OPEN
- Priority: P2
- Area: Analytics / Article
- Added: 2026-08-08
- Reason deferred: pre-existing architecture (not introduced by Task 3);
  does not corrupt any admin/business analytics number today because no
  admin dashboard reads `Article.views` (confirmed:
  `analyticsContentPerformance.service.ts` derives "views" purely from
  `UserEvent`). Fixing it is an architecture-consolidation change, not a
  correctness fix, so it does not block PROD per Task 3's own "do not
  create a parallel analytics architecture" instruction (which is about not
  adding a *new* one — this one already existed).
- Context: `src/lib/article/articleViews.ts` →
  `incrementPublishedArticleViews()` does a raw
  `prisma.article.updateMany({ data: { views: { increment: 1 } } } })` on
  every real `/blog/[slug]` request, entirely outside the `UserEvent` /
  `AnalyticsEntityType.ARTICLE` pipeline that `DETAIL_OPEN` already covers
  for articles. Two different "how many times was this Article viewed"
  numbers exist in the codebase with no reconciliation.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: decide whether `Article.views` should be retired in
  favor of the `UserEvent`-derived `Opens` count (Task 3's canonical view
  metric) or kept as a distinct, differently-scoped counter — and document
  the decision. Not urgent; no incorrect number is currently shown to any
  user as a result of the duplication.
- Source: `docs/release/dev-to-prod-checklist.md` Task 3 audit
  (Publication Analytics)

## [BACKLOG-028] `PAGE_VIEW`, `UNSAVE`, `PLAN_REMOVE` UserEventType values defined but never emitted

- Status: OPEN
- Priority: P3
- Area: Analytics
- Added: 2026-08-08
- Reason deferred: dead enum values with no functional impact — nothing in
  the product currently needs "unsave"/"remove from plan"/"raw page view
  distinct from card view" as a tracked signal; the metrics that matter for
  Task 3's exit criteria (Opens, Saves, PlanAdds, CTA) already work via
  `DETAIL_OPEN`/`SAVE`/`PLAN_ADD`/`CTA_CLICK`.
- Context: `UserEventType` enum (`prisma/schema.prisma`) includes
  `PAGE_VIEW`, `UNSAVE`, `PLAN_REMOVE`. Grep of `src/` found zero emitters
  for any of the three. `analyticsContentPerformance.service.ts` already
  treats `VIEW_TYPES = ["PAGE_VIEW", "CARD_VIEW"]` defensively (i.e. it
  would pick up `PAGE_VIEW` automatically if it were ever emitted).
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: either wire real emitters (e.g. fire `UNSAVE`/
  `PLAN_REMOVE` from the existing DELETE handlers in `/api/save/idea` and
  `/api/save/plan`, which currently call `trackUserEvent` on create but not
  on remove) or remove the unused enum values, as a deliberate follow-up
  decision.
- Source: `docs/release/dev-to-prod-checklist.md` Task 3 audit
  (Publication Analytics)

## [BACKLOG-029] No `SHARE` analytics signal despite live Share UI

- Status: OPEN
- Priority: P2
- Area: Analytics
- Added: 2026-08-08
- Reason deferred: requires a new `UserEventType` enum value (schema
  migration, hand-written per this repo's Prisma rules), a materially
  bigger and riskier change than the phone/website/CTA fixes made in this
  task; existing View+CTA+Save+PlanAdd signals already satisfy Task 3's
  exit criteria without it.
- Context: `ShareModal.tsx` / `ShareSheet.tsx` (used from
  `MarketplacePlacePage.tsx`, `PlaceSidebarCard.tsx`, `BreakingNewsView.tsx`,
  Route detail) are real, live share actions with zero analytics
  instrumentation — no `SHARE` `UserEventType` exists in the schema at all.
  Correction (Task 6, 2026-08-11): at the time this entry was written,
  `BreakingNewsView.tsx` did **not** actually use `ShareModal` — it had its
  own bespoke `handleShare()` (native share + manual clipboard fallback, no
  Telegram/WhatsApp). Task 6 replaced that bespoke handler with
  `ArticleDetailActions` → `ShareModal` (small local substitution, no
  behavioral regression — see `src/components/article/mvp/BreakingNewsView.tsx`
  `NewsHero`), so the Context line above is now accurate for real.
- Current state: not started.
- Dependencies: a new, hand-written Prisma migration adding a `SHARE` value
  to the `UserEventType` enum (see `CLAUDE.md` Prisma-migration rules —
  `prisma migrate dev` does not work in this repo).
- Acceptance criteria: add `SHARE` to `UserEventType`, emit it from the
  existing Share components with entity context, surface it in
  `analyticsContentPerformance.service.ts` alongside `ctaClicks`.
- Source: `docs/release/dev-to-prod-checklist.md` Task 3 audit
  (Publication Analytics)

## [BACKLOG-030] `/business/analytics` is an empty "under development" placeholder

- Status: DONE (2026-08-09)
- Priority: P2
- Area: Business / Analytics
- Added: 2026-08-08
- Resolution: owner reopened this specifically for Task 3 (Business
  Analytics MVP follow-up). `/business/analytics` now renders a real page:
  own Event/Offer/Place publications with real aggregate metrics (Показы/
  Открытия/Сохранения/В план/Целевые действия), a 5-option date range, and
  a per-publication drill-down (same report + CTA target-action breakdown
  already built for Admin, via the shared `PublicationAnalyticsDrawer`/
  `getPublicationAnalyticsDetail`). Server-side ownership is re-verified per
  request (`businessOwnsPublication()`) before any aggregation runs —
  foreign/nonexistent publication -> 404, zero metric leakage. Tests:
  `businessAnalyticsAccess.test.ts` (own/foreign Event/Offer/Place,
  nonexistent id, Article/Route always rejected). The Dashboard's own
  Top-5 (`getBusinessWorkspaceData`/`TopPublicationList`) is unchanged,
  now links to `/business/analytics` instead of duplicating the full report.
- Context (original): `src/app/business/(protected)/analytics/page.tsx` was
  a 14-line file rendering only `<BusinessSectionHeader ... description=
  "Раздел в разработке" />` — no data fetching at all.
- Source: `docs/release/dev-to-prod-checklist.md` Task 3 audit
  (Publication Analytics) — resolved under Task 3's Business Analytics MVP
  follow-up.

## [BACKLOG-031] `/api/publication-stats/[entityId]` always returns nulls — real aggregator not wired

- Status: OPEN
- Priority: P2
- Area: Admin / Analytics
- Added: 2026-08-08
- Reason deferred: self-documented honest-empty-state stub (not fake data —
  satisfies Task 3's "no fake analytics" hard requirement already); Task
  3's exit criteria for real admin publication analytics is already met via
  the working `/admin/analytics/content-performance` dashboard, so this
  redundant, unfinished surface does not block PROD.
- Context: `src/app/api/publication-stats/[entityId]/route.ts:37-42`
  unconditionally calls `buildEmptyPublicationStats()` with an explicit
  code comment that the real aggregator isn't connected yet. Full
  production-ready UI exists around it (`PublicationStatsDrawer`,
  `PublicationStatsDetails`, period switcher, 8 accordion sections,
  role-based visibility for ADMIN/BUSINESS_OWNER) wired to a backend with
  zero real aggregation logic — renders an honest "Данных пока нет" state,
  not fabricated numbers.
- Current state: not started.
- Dependencies: decide whether to build the real aggregator (likely
  reusing the same `UserEvent` queries as `analyticsContentPerformance.
  service.ts`) or retire this parallel feature in favor of the working
  Content Performance dashboard.
- Acceptance criteria: either a real aggregator behind this endpoint, or
  the feature is consciously retired — not left as permanent dead UI.
- Source: `docs/release/dev-to-prod-checklist.md` Task 3 audit
  (Publication Analytics)

## [BACKLOG-032] `CARD_VIEW` impression tracking missing for Place/Offer listing cards

- Status: PARTIALLY RESOLVED (2026-08-09) — Offer/Article done, Place open
- Priority: P3
- Area: Analytics
- Added: 2026-08-08
- Resolution (Offer, Article): Task 3 MVP drill-down follow-up audited the
  real listing/card surfaces for Place/Offer/Article and wired
  `AnalyticsCardViewTracker` onto every real one found for Offer and
  Article: `src/app/(public)/[city]/programs/page.tsx` (the "Занятия"
  full listing), `src/features/city-home/components/
  CityHomeContentRows.tsx`'s `CityHomeClassesSection` (homepage "Занятия"
  preview row, Offer) and `CityHomeJournalSection` (homepage "Статьи и
  обзоры" preview row, Article), and `src/app/(public)/blog/BlogIndex.tsx`
  (the canonical `/blog` journal index, both the featured article and the
  article list). `listCityHomeArticles.ts` gained the article's own `id`
  field (previously not selected at all — a real, separate gap this fix
  surfaced) since impression tracking needs the real Article id, not just
  its slug.
- Remaining (Place): confirmed by routing audit — `/[city]/places` has
  only a `[slug]` detail route, no listing `page.tsx`; no component search
  (`PlaceCard`, homepage, tag pages, `where-to-go`/`kuda` — both pure
  redirects) found any public Place browsing/catalog surface. Place is
  today only reachable via direct link, search, or embedded article
  content blocks (`ArticlePlaceCardBlock`). There is genuinely nothing to
  wire impression tracking onto for Place yet — inventing a new listing
  page would be a real scope expansion, explicitly out of bounds for this
  follow-up ("do not invent a new impression system" / reuse existing
  surfaces only).
- Current state: Offer + Article done and deployed-pending; Place not
  started (blocked on a Place listing/catalog page existing at all — a
  product surface decision, not an analytics one).
- Dependencies (Place): a real Place listing/catalog page would need to
  exist first; out of Task 3's scope to build one.
- Acceptance criteria (Place): once/if a Place listing surface exists,
  wire `AnalyticsCardViewTracker` onto it the same way.
- Source: `docs/release/dev-to-prod-checklist.md` Task 3 audit
  (Publication Analytics) + MVP drill-down follow-up
- Source: `docs/release/dev-to-prod-checklist.md` Task 3 audit
  (Publication Analytics)

## [BACKLOG-033] `SAVE`/`PLAN_ADD` not tracked for Route entity type

- Status: OPEN
- Priority: P3
- Area: Analytics / Routes
- Added: 2026-08-08
- Reason deferred: Route is a small, secondary content type (per Task 1's
  own prior classification); `/api/save/plan`'s `routeId` branch exists and
  works functionally, it just doesn't call `trackUserEvent` — a narrow,
  isolated, low-value gap relative to the P1 CTA gaps fixed in Task 3.
- Context: `src/app/api/save/plan/route.ts` has a `routeId` branch (around
  line 89-97) with no `trackUserEvent` call, unlike its `placeId`/
  `activityId` siblings. `src/app/api/save/idea/route.ts` has no `routeId`
  branch at all (Routes cannot be saved as "ideas" today, so there is
  nothing to track there).
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: add a `trackUserEvent({eventType: "PLAN_ADD",
  entityType: "ROUTE", ...})` call to the existing `routeId` branch,
  matching the `place`/`activity` pattern already in the same file.
- Source: `docs/release/dev-to-prod-checklist.md` Task 3 audit
  (Publication Analytics)

## [BACKLOG-034] No rate limiting on `POST /api/analytics/events`

- Status: OPEN
- Priority: P3
- Area: Analytics / Security
- Added: 2026-08-08
- Reason deferred: ingestion is already bounded (zod-validated enum
  fields, 4096-byte meta cap, single indexed row write, fire-and-forget);
  the repo's only reusable rate limiter (`src/lib/security/rateLimit.ts`)
  is Postgres-backed and would itself double the write cost of every
  analytics event (an extra `RateLimitEntry` upsert per event) — directly
  against Task 3's "server cost — critical" instruction. Not a proven P0/P1
  abuse vector at current scale; a cheaper mechanism (if ever needed) should
  be chosen deliberately, not bolted on reactively.
- Context: `src/app/api/analytics/events/route.ts` has no rate limiting and
  does not verify `entityId` refers to a real row before writing a
  `UserEvent`. Worst case today is analytics-table noise (extra rows with
  a nonexistent entityId), not a security or correctness issue —
  `entityId`/`entityType` are still enum/string-validated so no SQL
  injection or arbitrary-schema risk exists.
- Current state: not started.
- Dependencies: pick a cheap (non-DB-write) rate-limiting mechanism if this
  is ever prioritized (e.g. a short in-memory per-instance token bucket
  keyed by session/IP, accepting best-effort accuracy across instances).
- Acceptance criteria: a documented decision either way; add limiting only
  if real abuse is observed.
- Source: `docs/release/dev-to-prod-checklist.md` Task 3 audit
  (Publication Analytics)

## [BACKLOG-035] `recomputeAllBehaviorSegments()` has no cron/scheduled caller

- Status: OPEN
- Priority: P3
- Area: Analytics
- Added: 2026-08-08
- Reason deferred: `UserBehaviorProfile.segmentKeys` recomputation on each
  individual event already happens synchronously in
  `applyUserBehaviorEvent()` (via `SegmentResolverService`), so segments
  are not stale for *active* users. The batch `recomputeAllBehaviorSegments`
  entry point exists for e.g. time-based segment transitions (a user who
  stops being "active this week") for users who generate no new events —
  a secondary, non-blocking concern for Task 3's view/CTA measurement
  scope; more relevant to Task 5 (Content Analytics & Ranking).
- Context: `SegmentResolverService.ts` exports
  `recomputeSegmentsForUser`/`recomputeAllBehaviorSegments`; no caller was
  found in `src/server/jobs`, `src/server/notifications/jobs`, or anywhere
  else in `src/`.
- Current state: not started.
- Dependencies: best picked up alongside Task 5 if/when segment freshness
  becomes a proven product need.
- Acceptance criteria: either wire a scheduled job calling
  `recomputeAllBehaviorSegments()` on a sane cadence (e.g. daily) or
  document that per-event recomputation is sufficient and the batch
  function is intentionally manual/on-demand.
- Source: `docs/release/dev-to-prod-checklist.md` Task 3 audit
  (Publication Analytics)

## [BACKLOG-036] New Place CTA_CLICK events (call/website/instagram) have no cityId

- Status: OPEN
- Priority: P3
- Area: Analytics / Place
- Added: 2026-08-09
- Reason deferred: the new phone/website/Instagram `CTA_CLICK` tracking
  added in Task 3 (Publication Analytics) correctly records entity, event
  type, and `targetAction` — proven via a controlled proof on real local
  data (`cityId: null` was the only gap, confirmed by direct DB read of the
  written row). Threading `place.cityId` down to `PlaceHero.tsx`
  (marketplace) / `PlaceSidebarCard.tsx` (premium) would need a new prop on
  both components' page-level parents (`PremiumPlacePageProps`,
  `MarketplacePlacePage`'s place type), which goes beyond Task 3's minimal
  fix for "is this CTA tracked at all" (now: yes) into a secondary
  refinement of "is it also city-tagged" — not required to satisfy Task 3's
  exit criteria, since these events are still fully visible/usable in the
  unfiltered (all-cities) admin view.
- Context: `src/components/place/marketplace/PlaceHero.tsx` and
  `src/components/place/premium/PlaceSidebarCard.tsx` both call
  `postAnalyticsEvent({eventType:"CTA_CLICK", entityType:"PLACE", ...,
  vertical:"CITY"})` without a `cityId`/`citySlug`, unlike the same Place's
  own `DETAIL_OPEN` beacon (which correctly uses `place.cityId`) and unlike
  `EventDecisionPanel`'s new phone-CTA tracking (which does pass
  `citySlug={data.citySlug}`, since `EventPageView`'s `data` already carried
  it).
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: add a `placeCityId`/`citySlug` prop to `PlaceHero`
  and `PlaceSidebarCard`, threaded from their respective parent pages
  (which already resolve `place.cityId` for the `DETAIL_OPEN` beacon), and
  pass it into the existing `trackCta()` helpers in both files.
- Source: `docs/release/dev-to-prod-checklist.md` Task 3 implementation
  (Publication Analytics)

## [BACKLOG-037] `OTP_SECRET` environment variable — DEV resolved, PROD still needs its own independent value

- Status: PARTIALLY RESOLVED (DEV done 2026-08-09; PROD portion OPEN, P1 —
  confirmed MISSING by Task 14 Phase A 2026-08-13)
- Priority: P1 (PROD readiness — must be verified before first PROD deploy)
- Area: Environment Parity / Business Onboarding / Secrets
- Added: 2026-08-09
- DEV resolution (2026-08-09): a DEV-only `OTP_SECRET` (generated with
  `openssl rand -base64 48`, never printed/logged/committed) was added to
  `dev-app-1`'s existing env mechanism on the shared host. Verified
  read-only post-restart via `docker exec dev-app-1 sh -c 'printenv | grep
  -c "^OTP_SECRET="'` → `1` (presence only, value never revealed). Owner
  independently confirmed the business signup phone-verification flow
  (`business.dev.mamago.by`, УНП/Юридическое название/Телефон ->
  "Подтвердить") now works end-to-end with no `OTP_SECRET environment
  variable is not configured` error. `prod-app-1`/`prod-db-1` on the same
  host were not touched.
- Original context: submitting the business-signup phone-verification step
  returned the literal error `OTP_SECRET environment variable is not
  configured. Please set a secure random string.` — DEV's environment was
  missing the value entirely. Discovered incidentally by the owner while
  looking for a second business account on deployed DEV for the Task 3
  Business Analytics ownership-isolation smoke.
- **Remaining requirement (P1, blocks first PROD deploy):** PROD must
  receive its **own independent** `OTP_SECRET` value — never the same
  secret as DEV's, never copied between environments. Task 14 Phase A
  (2026-08-13) confirmed PROD persistent `/opt/mamago/prod/.env` and
  `prod-app-1` runtime: `OTP_SECRET=MISSING`. DEV remains SET. No value
  was printed or copied. Phase B must generate a new PROD secret in the
  existing PROD env mechanism.
- Acceptance criteria (remaining): PROD confirmed to have its own
  independently-generated `OTP_SECRET` (existence checked the same
  read-only way — never comparing/printing values), verified as part of
  Task 14 Phase B, before first PROD deployment.
- Source: owner-reported and owner-directed fix, during Task 3 (Publication
  Analytics) deployed-DEV smoke.
  smoke session.

## [BACKLOG-038] `/api/geo/enrich-location` fallback name-matching reads legacy `long_name`, never matches new `PlaceAutocompleteElement` address components

- Status: OPEN
- Priority: P2
- Area: Google Maps / Geo Enrichment
- Added: 2026-08-10
- Reason deferred: only affects the fallback path (when centroid-based
  district/metro lookup fails to find a match within radius); the primary
  path was proven working during Task 4 manual verification, so this is a
  latent robustness gap, not a blocking correctness bug for the address
  round-trip Task 4 was scoped to fix. Fixing it correctly means
  normalizing two different Google address-component shapes in a shared
  endpoint also used by Place Wizard — out of Task 4's narrow scope
  ("Place Wizard is DO NOT TOUCH").
- Context: `src/app/api/geo/enrich-location/route.ts`
  (`extractDistrictNameFromAddressJson`/`extractMetroNameFromAddressJson`,
  ~line 56-89) reads `comp?.long_name` — the legacy Google Places
  JS `Autocomplete` widget's `address_components` shape, still produced by
  `src/components/business/place/PlaceSearchInput.tsx` (Place Wizard).
  But `src/components/business/wizard/event/steps/location/EventLocationSearchInput.tsx`
  (Event Wizard, uses the new `PlaceAutocompleteElement`) captures
  `place.addressComponents` in the **new** shape, where each component has
  `longText`/`shortText` instead of `long_name`/`short_name` — confirmed by
  inspecting live `pendingLocation.addressJson` written during Task 4
  manual testing (entries like `{"types":["route"],"longText":"улица
  Немига","shortText":"ул. Немига"}`). Any event-wizard-created place whose
  district/metro can't be resolved by centroid/radius distance will
  silently fail the address-component fallback match.
- Current state: not started. Primary centroid-based resolution (the
  common case) is unaffected and was verified working end-to-end
  (district/metro correctly resolved for two different Minsk addresses
  during Task 4 QA).
- Dependencies: none.
- Acceptance criteria: `extractNamedComponentFromAddressJson` (or its
  callers) accepts both `long_name`/`short_name` and `longText`/`shortText`
  shapes, with a regression test covering both Google API response
  formats.
- Source: discovered during Task 4 (Event Wizard address dropdown) manual
  proof, DB inspection of `Activity.scheduleJson.pendingLocation.addressJson`.

## [BACKLOG-039] `EventLocationPicker.tsx` — dead code, zero importers

- Status: OPEN
- Priority: P3
- Area: Event Wizard / Cleanup
- Added: 2026-08-10
- Reason deferred: pure cleanup, no behavior change; kept out of Task 4's
  diff to keep that change reviewable and scoped to the proven address
  data-loss root cause.
- Context: `src/components/business/wizard/event/steps/location/EventLocationPicker.tsx`
  sits alongside the live `EventLocationSearchInput.tsx`/`QuickPlaceCreate.tsx`
  in the same `location/` folder but has zero importers anywhere in the
  codebase (confirmed via repo-wide grep during Task 4 audit) — appears to
  be an abandoned/superseded component from an earlier iteration.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: confirm zero importers still holds, delete the file.
- Source: Task 4 (Event Wizard address dropdown) Phase 1 audit.

## [BACKLOG-040] Place Wizard's `PlaceSearchInput.tsx` still uses deprecated Google `Autocomplete` widget

- Status: OPEN
- Priority: P3
- Area: Google Maps / Place Wizard
- Added: 2026-08-10
- Reason deferred: Place Wizard is explicitly out of scope for Task 4
  ("DO NOT TOUCH" — it's the working reference implementation Task 4
  compared against). The code already carries its own tracked TODO for
  this migration.
- Context: `src/components/business/place/PlaceSearchInput.tsx:41-42` has
  an existing comment: `// TODO(google-maps-tech-debt): migrate from
  deprecated Autocomplete to PlaceAutocompleteElement after we finish
  stabilizing the geo options + enrichment flow in Place Wizard step 2.`
  Event Wizard's `EventLocationSearchInput.tsx` already uses the modern
  `PlaceAutocompleteElement` (migrated independently), so the two wizards
  now use two different Google Places widgets for the same job — a
  drifted/duplicated implementation confirmed during Task 4's Phase 2
  comparison audit.
- Current state: not started.
- Dependencies: none — the migration path is already proven working in
  Event Wizard's implementation and can be used as a reference.
- Acceptance criteria: `PlaceSearchInput.tsx` migrated to
  `PlaceAutocompleteElement`, Place Wizard address flow regression-tested
  (existing Place edit, new Place create, duplicate detection, map
  fallback).
- Source: Task 4 (Event Wizard address dropdown) Phase 2 comparison audit.

## [BACKLOG-041] Design optional quality/trust layer from ratings and reviews

- Status: OPEN
- Priority: P2
- Area: Ranking / Ratings
- Added: 2026-08-10
- Reason deferred: Task 5's own scope was narrowed by the owner to
  formalizing/correcting the existing engagement-weight table only. Wiring
  ratings/reactions in naively would be actively wrong: `PlaceReview`
  carries a `rating` value (can be low/negative) and `RouteRating`/
  `ArticleRating` carry like/neutral/dislike semantics — simply emitting a
  positive `UserEventType.FEEDBACK_LEFT`-style signal on submission would
  incorrectly boost content with negative reviews/dislikes, exactly the
  failure mode this deferral avoids.
- Owner decision (2026-08-10): ratings/reviews do **not** belong in the
  base engagement-ranking formula. Any future use must be an optional,
  weak quality/trust layer — separate from and applied on top of the base
  engagement score, not merged into it. That layer must: distinguish
  mamaGo first-party reviews from Google reviews (different trust/
  provenance), account for source/confidence/sentiment, and must never
  let negative feedback boost content. Implementation is gated on PROD
  data showing this layer is actually useful — do not build ahead of that
  evidence. No Task 5 runtime code was changed for this decision; it is
  docs-only.
- Context: `PlaceReview` (`prisma/schema.prisma:1277`, rating+text+
  moderation+owner reply, live at `POST /api/places/[id]/reviews`),
  `RouteRating`/`ArticleRating` (`prisma/schema.prisma:4458/4477`, one
  vote per identifier, live via `RouteRatingBlock.tsx`/`/api/articles/
  rate`) do not call `trackUserEvent()` on submission — confirmed by
  code read. `UserEventType.FEEDBACK_LEFT` is only emitted from
  `BookingFeedback` (`src/server/analytics/trackBookingEvent.ts:176`),
  which is a genuine 1–5 star positive-only signal, unlike the other
  three. Google reviews are also surfaced in-product (separate
  provenance from mamaGo first-party `PlaceReview`), which the future
  design must account for explicitly.
- Current state: not started — decision above defines direction only, no
  design doc yet.
- Dependencies: PROD engagement/ranking data showing the base formula
  needs this layer (blocking — do not implement before this evidence
  exists).
- Acceptance criteria: a design (not the old naive wiring) for an
  optional, signed, source-aware quality/trust layer applied on top of
  the base engagement score — normalized/signed signal distinguishing
  positive from negative/neutral feedback, mamaGo-first-party vs Google
  provenance kept distinct, confidence/sentiment accounted for, negative
  feedback never boosts — decided and implemented as a deliberate
  follow-up only after PROD data justifies it.
- Source: `docs/release/dev-to-prod-checklist.md` Task 5 audit (Content
  Analytics & Ranking); owner clarification 2026-08-10.

## [BACKLOG-042] `UserBehaviorProfile.segmentKeys` computed but never consulted by ranking/recommendation code

- Status: OPEN
- Priority: P2
- Area: Ranking / Personalization
- Added: 2026-08-10
- Reason deferred: owner explicitly scoped Task 5 to formalizing/correcting
  the existing ranking system, not adding personalization. `segmentKeys`
  (20 rule-based segments: `NEW_USER`/`RETURNING_USER`/`ACTIVE_USER`/
  `DORMANT_USER`, `BROWSER`/`SAVER`/`PLANNER`/`BUYER_INTENT`,
  `LAST_MINUTE`/`ADVANCE_PLANNER`/`WEEKEND_ORIENTED`/`WEEKDAY_ORIENTED`,
  `ONE_CHILD`/`MULTI_CHILD`, `PREFERS_*`, `PRICE_SENSITIVE`) is recomputed
  synchronously on every `UserEvent` write (`UserBehaviorAggregationService.
  ts` → `SegmentResolverService.ts`) and is fully live/correct — but every
  reader found (`analyticsBehavior/Segments/Overview.service.ts`) is an
  admin dashboard, never a ranking/discovery-feed/recommendation code path.
- Context: exhaustive grep across `src/` for `segmentKeys`/
  `UserBehaviorProfile` readers found zero hits in
  `kudaDiscoveryFeed.ts`/`classesDiscoveryFeed.ts`/`planSuggestions.
  service.ts` or anywhere else outside `src/app/api/admin/analytics/*` and
  `src/app/api/user/delete/route.ts` (deletion cascade only).
- Current state: not started.
- Dependencies: none blocking; a real product decision on whether/how to
  personalize (e.g. `NEW_USER`-aware cold-start ordering, `SAVER`/
  `PLANNER`-aware weighting) should precede implementation.
- Acceptance criteria: a deliberate product/design decision on which
  segments (if any) should influence ranking, and how, before any code
  change — explicitly not automatic just because the data exists.
- Source: `docs/release/dev-to-prod-checklist.md` Task 5 audit (Content
  Analytics & Ranking).

## [BACKLOG-043] Second, fully-built Stories-rail redesign exists dead in the codebase, never wired

- Status: OPEN
- Priority: P2
- Area: Stories / Home Page
- Added: 2026-08-10
- Reason deferred: owner explicitly excluded Stories-rail changes from
  Task 5's narrowed scope — the live editorial rail (`StoriesSection.tsx`/
  `HomeStoryItem`) is working and untouched; this item needs its own
  separate owner decision (finish wiring the redesign, or delete it),
  mirroring the shape of the existing worktree-recovery backlog items
  (BACKLOG-001/002/010/011/012 — real prior effort sitting unintegrated).
- Context: `src/server/stories/resolveStoryRail.ts` +
  `loadStoryRailCandidatePool.ts` + `src/lib/stories/registry.ts`
  (`STORY_SLOTS` registry, intents `today`/`running`/`lastchance` — a
  materially different vocabulary from the live rail's
  `today`/`tomorrow`/`weekend`/`free`/`breaking_news`) implement a real,
  tested (`resolveSlots.test.ts`, `dateRangeWhere.test.ts`), DB-querying
  rail with real classification/caching logic — but `buildStoryRailData`/
  `loadStorySlotContent` are imported nowhere outside `resolveStoryRail.ts`
  itself. `CityHomePage.tsx` only ever imports the live `StoriesSection`.
  Appears to be an abandoned in-progress redesign.
- Current state: not started. Confirmed still unwired as of this audit.
- Dependencies: none blocking; needs an explicit owner decision before
  either finishing the wiring or deleting the module.
- Acceptance criteria: owner decides — either the redesign is finished and
  wired into `CityHomePage.tsx` (replacing or complementing the live rail),
  or the dead module is deleted. Not left ambiguous indefinitely.
- Source: `docs/release/dev-to-prod-checklist.md` Task 5 audit (Content
  Analytics & Ranking).

## [BACKLOG-044] `Occasion.boostScore` seasonal boost only applied to Events, not Offers/Places/Articles/Routes

- Status: OPEN
- Priority: P2
- Area: Ranking / Seasonality
- Added: 2026-08-10
- Reason deferred: not a defect — `Occasion` boost is a real, live,
  admin-curated seasonal signal, just scoped to one entity type today;
  extending it is a deliberate follow-up, not part of Task 5's narrowed
  weight-correction scope.
- Context: `getActivityOccasionBoosts()` (`src/lib/discovery/occasions.ts`)
  is consumed only by `kudaDiscoveryFeed.ts:97` (MAX-aggregated, "soft
  contextual ranking signal, not a visibility rule" per its own comment).
  `classesDiscoveryFeed.ts` (Offers) and any future Place/Article/Route
  ranking do not consult it at all.
- Current state: not started.
- Dependencies: none blocking.
- Acceptance criteria: a product decision on whether seasonal/occasion
  boosting should extend to Offers (and, if Place/Article/Route ever gain
  ranked listings, to those too), then implement by reusing
  `getActivityOccasionBoosts()`'s existing pattern — no new model.
- Source: `docs/release/dev-to-prod-checklist.md` Task 5 audit (Content
  Analytics & Ranking).

## [BACKLOG-045] Duplicated "today/weekend" date-range logic — Stories vs. discovery filters

- Status: OPEN
- Priority: P3
- Area: Ranking / Cleanup
- Added: 2026-08-10
- Reason deferred: pure cleanup, no behavior difference currently observed
  between the two implementations; not urgent, out of Task 5's narrowed
  scope.
- Context: `src/lib/stories/ranges.ts` (`todayRange`/`tomorrowRange`/
  `weekendRange`/`nextWeekRange`, timezone-aware, used by Stories) and
  `src/features/filters/discovery/whenLabel.ts`'s own local
  `computeWeekendRange()` (used by the discovery "when" filter) implement
  the same concept independently — confirmed via grep that neither file
  imports from the other.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: consolidate into one shared date-range utility,
  used by both Stories and discovery filters.
- Source: `docs/release/dev-to-prod-checklist.md` Task 5 audit (Content
  Analytics & Ranking).

## [BACKLOG-046] `StoryIntentConfig.itemLimit`/`allowedTypes` — dead sub-fields on an otherwise-live model

- Status: OPEN
- Priority: P3
- Area: Stories / Admin
- Added: 2026-08-10
- Reason deferred: low value, no behavior impact — the model's other
  fields (`title`/`enabled`/`order`) are genuinely live and admin-edited;
  these two are simply unused.
- Context: `StoryIntentConfig.itemLimit`/`.allowedTypes` are defined in the
  Prisma model and typed in `StoryIntentRulesPanel.tsx`'s TS type, but the
  admin UI never renders/edits them and the public reader
  `getPublicStoryIntentConfigs()` (`src/server/stories/
  storyIntentConfig.ts:10-14`) only selects `{intent, title, enabled,
  order}` — confirmed via grep these two fields appear only in seed
  defaults and the UI type declaration.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: either wire `itemLimit`/`allowedTypes` into the
  rail's rendering (cap items per intent, restrict entity types) or remove
  them from the model/admin type.
- Source: `docs/release/dev-to-prod-checklist.md` Task 5 audit (Content
  Analytics & Ranking).

## [BACKLOG-047] `SignalDefinition.isFeatured`/`EventCategory.isFeatured` — admin-editable, never read publicly

- Status: OPEN
- Priority: P3
- Area: Admin / Taxonomy
- Added: 2026-08-10
- Reason deferred: decorative/dead flags, no release risk, low value
  cleanup.
- Context: both fields are editable via their respective admin CRUD
  screens (`/admin/taxonomy/signals/[slug]`, `/admin/taxonomy/
  event-categories/[id]`) but have zero reads anywhere outside their own
  admin CRUD — confirmed the corresponding public routes
  (`api/public/signals/*`, `api/public/event-categories/route.ts`) don't
  select or order by either field.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: either wire `isFeatured` into real public
  ordering/highlighting, or remove the field and its admin UI control.
- Source: `docs/release/dev-to-prod-checklist.md` Task 5 audit (Content
  Analytics & Ranking).

## [BACKLOG-048] `Plan.hasPriorityBoost`/`PRIORITY_BOOST` commercial-feature scaffolding — zero callers, not sold

- Status: OPEN
- Priority: P3
- Area: Billing / Commercial
- Added: 2026-08-10
- Reason deferred: dead scaffolding, not urgent. Explicitly checked and
  confirmed **not** a false-advertising risk before filing as low
  priority: grepped all business-facing UI/API directories
  (`src/app/business`, `src/components/business`, `src/app/api/business`)
  for "приоритет"/"priority" — no marketing copy references this feature,
  so nothing currently promises businesses a capability that doesn't work.
- Context: `Plan.hasPriorityBoost` (`prisma/schema.prisma:2201`) →
  `commercialAccess.service.ts` computes a `PRIORITY_BOOST` feature flag
  ("Priority in search results") and exposes `canUsePriorityBoost` via
  `getBusinessFeatureCapabilities()` — which has zero callers anywhere
  else in `src/` (confirmed by grep). No query branches on
  `canUsePriorityBoost` today. Distinct from the real, live `Boost` model
  (`Offer.boosts`) that already drives real paid-visibility ranking in
  `classesDiscoveryFeed.ts` — this is separate, unfinished scaffolding for
  a plan-tier entitlement concept that was never connected to anything.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: either build the real paid-boost mechanism this
  scaffolding implies (a product/pricing decision) or remove the dead
  flag/plumbing (`hasPriorityBoost`, `PRIORITY_BOOST`,
  `canUsePriorityBoost`, `getBusinessFeatureCapabilities()` if nothing else
  uses it).
- Source: `docs/release/dev-to-prod-checklist.md` Task 5 audit (Content
  Analytics & Ranking).

## [BACKLOG-049] `Minified React error #310` fires globally on deployed DEV

- Status: OPEN
- Priority: P2
- Area: Frontend / Investigation
- Added: 2026-08-10
- Reason deferred: surfaced incidentally during Task 5's deployed-DEV
  regression smoke, not investigated or fixed there — out of that task's
  scope (Task 5's diff contains zero React/frontend files) and not
  something to debug live during a closure smoke. Needs its own dedicated
  investigation.
- Context: `read_console_messages` showed `Uncaught {stack: Error:
  Minified React error #310; ...}` (pointing into chunk
  `2fac11ac-eed2b5b701c87048.js`) on **every** page visited during the
  Task 5 DEV smoke on `https://dev.mamago.by` — `/minsk` (plain homepage,
  no ranking-specific code), `/minsk/kuda` (Events discovery), and
  `/minsk/classes` (Offers discovery) all reproduced it identically, under
  the owner's persisted authenticated ADMIN browser session. Confirmed
  **not** introduced by Task 5: it appears on non-ranking pages just as
  much as ranking pages, and Task 5's entire diff (`d5b149bc`) touches only
  `src/server/discovery/engagementWeights.ts`/`eventEngagementScores.ts`
  and deletes a dead, non-imported folder — no React/component/frontend
  file. Despite the console error, every page rendered its full, correct
  content in every case observed (Kuda feed card, Classes empty state, My
  Plan page, admin Offers list) — not blocking, not a visible breakage.
  Root cause not identified (not investigated this session, per
  instruction) — candidates to check first: whether it reproduces for a
  logged-out/guest session (this smoke only had an authenticated ADMIN
  session available), and what specifically in the shared app/layout
  bundle (`2fac11ac-...js`, loaded on every page) throws it.
- Current state: not started. Not reproduced/tested against a guest
  (unauthenticated) session — unknown whether it's session-specific.
- Dependencies: none blocking.
- Acceptance criteria: root-caused via the unminified React error message
  (decode via https://react.dev/errors/310 or a dev-mode build), reproduced
  reliably (including checking guest vs. authenticated sessions), and
  either fixed or explicitly confirmed benign/expected with a documented
  reason.
- Source: Task 5 (Content Analytics & Ranking) deployed-DEV regression
  smoke, 2026-08-10.

## [BACKLOG-050] Guest pending-action resume is inert for Place (and never existed for Offer)

- Status: OPEN
- Priority: P2
- Area: Auth / Save-Plan
- Added: 2026-08-11
- Reason deferred: found during Task 6 (Article Actions) audit while
  generalizing `SaveActivityFlowAdaptive`'s pending-action builder for
  Article; fixing Place/Offer is a separate, independently-scoped change
  with its own verification, not required for Task 6's exit criteria.
- Context: `PendingEntityType` (`src/lib/post-auth/types.ts`) only ever
  supported `"activity"` and `"route"` (Task 6 added `"article"`) — never
  `"place"` or `"offer"`. `PlaceSaveHeart.tsx` never passes an
  `activityId`/`pendingEntityId` prop into `SaveActivityFlowAdaptive`, so the
  guest → auth → resume fallback (`savePostAuthContext` inside
  `SaveActivityFlowAdaptive.handleCommit`) is silently skipped for places: a
  guest who picks "В идеи"/"Добавить в план" on a Place, then logs in, does
  **not** get their choice replayed — the modal still works, but the
  persistence step is dropped. Offers have no `OfferSaveHeart`-equivalent
  pending-action wiring at all.
- Current state: not started.
- Dependencies: none blocking; mechanical extension of the same pattern
  Task 6 used for Article (`pendingEntityType`/`pendingEntityId` props +
  `PendingEntityType` union + `executePendingPostAuthAction` branch).
- Acceptance criteria: `"place"` (and `"offer"` if offers are meant to
  support guest save) added to `PendingEntityType`; `PlaceSaveHeart` passes
  `pendingEntityType="place"` + `pendingEntityId`; `executePendingPostAuthAction`
  gets a `place` branch posting to `/api/save/idea`/`/api/save/plan` with
  `placeId`; guest → auth → resume verified end-to-end for Place.
- Source: Task 6 (Article Actions) audit, 2026-08-11.

## [BACKLOG-051] Per-card `/api/save/status` N+1 on Activity/Offer/Event listing grids

- Status: OPEN
- Priority: P2
- Area: Performance / Save-Plan
- Added: 2026-08-11
- Reason deferred: found during Task 6 (Article Actions) audit; fixing it
  requires touching `SaveHeart`/`ActivityCard`/`OfferCard`/`EventCard` and
  every grid that renders them (`ActivityGrid`, `DiscoveryActivitiesGrid`,
  `CityHomeContentRows`, `PlaceEventsSection`, `/programs`), a materially
  larger and riskier change than Task 6's scope (Article-only). Task 6's own
  exit criteria explicitly required the Article batch mechanism NOT be
  extended to other entity types without a separate decision.
- Context: `SaveHeart.tsx` self-fetches `GET /api/save/status?activityId=...`
  on mount, and it is rendered once per card inside `ActivityCard`/
  `OfferCard`/`EventCard`. A grid of N activity/offer/event cards therefore
  fires N independent save-status requests on page load (confirmed live via
  `read_network_requests` during Task 6 browser verification: `/minsk`
  fired 5 duplicate-per-id `GET /api/save/status?activityId=...` pairs for
  a 5-card "Куда пойти" row). Task 6 built a bounded batch endpoint
  (`POST /api/save/status/articles`) + `skipOwnFetch` pattern on
  `ArticleSaveHeart` specifically to avoid this for Article cards — the same
  approach is directly reusable here.
- Current state: not started.
- Dependencies: none blocking.
- Acceptance criteria: a batched save-status mechanism for
  Activity/Offer/Event listing grids (mirroring
  `POST /api/save/status/articles` — bounded, deduped, user-scoped), wired
  into the relevant grid components with no N+1 on page load; single-entity
  detail pages (`OfferPageView`, `EventPageView`, etc.) keep their existing
  single-item `/api/save/status` call unchanged.
- Source: Task 6 (Article Actions) audit + live DEV network trace,
  2026-08-11.

## [BACKLOG-052] Global Share implementation consolidation (`ShareModal` / `ShareSheet` / bespoke handlers)

- Status: OPEN
- Priority: P3
- Area: Frontend / Design system
- Added: 2026-08-11
- Reason deferred: Task 6 (Article Actions) only swapped `BreakingNewsView`'s
  bespoke `handleShare()` for the shared `ShareModal` (a small, low-risk
  local substitution scoped to Article). A full consolidation would also
  touch `src/components/routes/ShareSheet.tsx` (used by
  `RouteDetailClient.tsx`) and any other independent share implementation —
  explicitly out of scope per Task 6's own instructions ("do not touch
  unrelated ... other Share implementations. Global Share consolidation is
  outside Task 6").
- Context: as of 2026-08-11 there are at least two independent share UIs in
  the codebase: `ShareModal.tsx` (Telegram/WhatsApp/native-share/copy-link,
  used by `SidebarCardShare` on Offer/Place/Event, and now Article via
  `ArticleDetailActions`) and `ShareSheet.tsx` (Route detail, different
  implementation). No `SHARE` analytics either way (see `BACKLOG-029`).
- Current state: not started.
- Dependencies: none blocking. Should probably land together with or after
  `BACKLOG-029` (`SHARE` analytics) so the consolidated component emits one
  consistent event shape from day one.
- Acceptance criteria: a single shared Share component/behavior used by
  every entity's detail page (Place, Offer, Event, Route, Article), with
  `ShareSheet.tsx` either retired in favor of `ShareModal` or the two
  reconciled into one, no behavioral regression on any existing entity.
- Source: Task 6 (Article Actions) audit, 2026-08-11.

## [BACKLOG-053] Normalize Save/Share action design across entity types to Task 6's canonical pattern

- Status: OPEN
- Priority: P3
- Area: Frontend / Design system
- Added: 2026-08-11
- Reason deferred: this is a cross-entity UX normalization follow-up, not a
  Task 6 requirement — Task 6 explicitly scoped this as "the intended
  direction for the wider mamaGo action design system" to be applied later,
  after an audit confirms other entity types currently differ. Task 6 itself
  must not be expanded into a full content-type refactor.
- Context: Task 6 (Article Actions) established the owner-approved canonical
  mamaGo pattern: **cards** → Heart save action only (no Share, no separate
  Ideas/Plan buttons — Heart opens the existing chooser); **detail/landing
  pages** → `♡ Сохранить` + `↗ Поделиться` as explicit text+icon actions;
  **full-content continuous-reading surfaces** behave like detail pages (own
  Save/Share per article). Other entity types (Place, Offer, Event, Route)
  were not audited for consistency with this pattern as part of Task 6.
- Current state: not started.
- Dependencies: `BACKLOG-050` (pending-action gaps), `BACKLOG-051` (N+1 gaps),
  `BACKLOG-052` (Share consolidation) are natural prerequisites/companions —
  normalizing the visual/interaction pattern without fixing the underlying
  save/share plumbing gaps would just spread the same bugs further.
- Acceptance criteria: an owner-approved audit of Place/Offer/Event/Route
  card and detail surfaces against the Task 6 canonical pattern, with a
  scoped follow-up task (or tasks) for any confirmed gaps — not a blanket
  refactor.
- Source: Task 6 (Article Actions) product decision, 2026-08-11.

## [BACKLOG-054] Local dev DB has `SearchDocument.cityId`/`SearchQueryLog` migrations applied that aren't in `dev` branch's `prisma/schema.prisma`

- Status: OPEN
- Priority: P2
- Area: Infra / Prisma migrations
- Added: 2026-08-11
- Reason deferred: discovered incidentally while applying Task 6's own
  migration (`prisma migrate status` before `migrate deploy`); confirmed no
  file/table overlap with Task 6's change (`ArticleIdea`/`PlanItem.articleId`
  vs. `SearchDocument`/`SearchQueryLog`), so not a blocker for Task 6. Fixing
  a foreign branch-merge gap is out of Task 6's scope per repo rules
  (foreign work-in-progress must not be silently fixed or absorbed).
- Context: `npx prisma migrate status` showed the local dev Postgres
  (`mamago2` @ `localhost:5433`) has two migrations applied —
  `20260806120000_add_search_document_city_id` and
  `20260806123000_add_search_query_log_click_fields` — that do **not** exist
  under `prisma/migrations/` on the `dev` branch. `git log --all` traced
  them to commit `98390674` ("chore(recovery): snapshot main working tree"),
  which only exists on branch `recovery/main-wip-snapshot-2026-08-07` — i.e.
  another session applied these migrations directly to the shared local dev
  DB from a WIP/recovery branch that was never merged into `dev`. Current
  `dev` `schema.prisma` is missing `SearchDocument.cityId` and
  `SearchQueryLog.searchId`/`clickedPosition`/`clickedAt` even though the DB
  already has the columns.
- Current state: not started. Not yet confirmed whether this recovery
  branch's search work is still wanted, superseded, or abandoned.
- Dependencies: needs an explicit decision from the repo owner on the
  `recovery/main-wip-snapshot-2026-08-07` branch's search-related changes
  (merge the missing migration files + schema changes into `dev`, or discard
  and let a future task redo the DB columns cleanly).
- Acceptance criteria: `prisma migrate status` on `dev` shows a clean match
  between local `prisma/migrations/` and the DB's `_prisma_migrations` table
  (no DB-side migrations missing from disk), `schema.prisma` reflects the
  real DB schema for `SearchDocument`/`SearchQueryLog`.
- Source: Task 6 (Article Actions) implementation, 2026-08-11 (`npx prisma
  migrate status` output during migration apply).

## [BACKLOG-055] Day Scenario: guest (unauthenticated) persistence not implemented

- Status: OPEN
- Priority: P2
- Area: My Plan / Day Scenario
- Added: 2026-08-11
- Reason deferred: explicit owner decision for the Task 7 MVP — persistent
  Scenario is authenticated-user only; guest Day Scenario was explicitly
  deferred rather than building a second parallel storage system.
- Context: `DayScenario` (Prisma model) and the standalone page at
  `src/app/(public)/[city]/my-plan/[date]/scenario/page.tsx` require
  `getCurrentUser()`, redirecting to login otherwise. Guests already have no
  path to the Day Scenario CTA at all (`GuestMyPlanPanel` never renders
  `BuildScenarioButton`), so this is a consistent, not a partial, gap.
- Current state: not started.
- Dependencies: none blocking; would need a product decision on whether
  guest Scenario should be a temporary client-only (localStorage) view or
  simply require login, before any implementation.
- Acceptance criteria: owner decision recorded, then implemented if wanted.
- Source: `docs/release/dev-to-prod-checklist.md` Task 7 (Day Scenario)
  implementation, owner-approved MVP scope

## [BACKLOG-056] Day Scenario: arbitrary reorder / manual duration editing

- Status: OPEN (narrowed 2026-08-11 — flexible-item time assignment shipped)
- Priority: P2
- Area: My Plan / Day Scenario
- Added: 2026-08-11
- Reason deferred: explicitly excluded from the Task 7 UX phase scope by the
  owner ("We are NOT building a full itinerary editor" / "Do NOT implement:
  drag-and-drop; arbitrary reorder; manual duration editing").
- Resolution so far (2026-08-11, Task 7 UX phase): **flexible-item start-time
  assignment is now implemented**, not deferred — a genuinely flexible
  Scenario item ("Гибкое время") can be assigned a Scenario-specific start
  time via "+ Назначить время" / "Изменить время"
  (`AssignScenarioTimeControl.tsx` → `setScenarioItemTimeAction` →
  `DayScenarioItemOverride`), participates in ordering
  (`sortScenarioItemsByEffectiveTime`) and conflict detection, survives
  reload, and is preserved/pruned correctly across "План изменился" →
  "Обновить сценарий" (kept for retained PlanItems, dropped via FK cascade
  for removed ones). This does **not** apply to items that already have an
  authoritative source time (`PlanItem.startsAt` or a recovered single
  same-date `ActivitySession`) — those are never overridable in this MVP,
  by design.
- Still deferred (unchanged): **arbitrary drag-and-drop reorder** (order is
  always derived from effective time, never manually persisted) and
  **manual duration editing** (no `duration` field exists on `PlanItem`;
  `resolveReliableDurationMinutes()` always returns `null` — see
  `src/features/my-plan/lib/scenarioProjection.ts` — free-gap and
  end-of-day-summary display are architected to use it but will not surface
  anything until a real duration source exists).
- Current state: flexible-item time assignment DONE; reorder/duration
  editing not started.
- Dependencies: reorder/duration would need a further data-model decision
  (a `duration` column, or extending `DayScenarioItemOverride`) — still
  deliberately not built speculatively.
- Acceptance criteria (remaining scope): owner decision on reorder/duration
  scope + data shape, then implemented.
- Source: `docs/release/dev-to-prod-checklist.md` Task 7 (Day Scenario)
  implementation, owner-approved MVP scope

## [BACKLOG-057] Day Scenario: pauses / free-interval representation

- Status: OPEN
- Priority: P3
- Area: My Plan / Day Scenario
- Added: 2026-08-11
- Reason deferred: explicitly excluded from the Task 7 MVP ("Do NOT
  implement: pause entities").
- Context: no `Pause`-like concept exists anywhere in the Scenario page or
  data model; only real `PlanItem`s render on the timeline.
- Current state: not started.
- Dependencies: none blocking.
- Acceptance criteria: owner decision on minimal representation (e.g. a
  derived gap-detection UI vs. a persisted item) before implementation.
- Source: `docs/release/dev-to-prod-checklist.md` Task 7 (Day Scenario)
  implementation, owner-approved MVP scope

## [BACKLOG-058] Day Scenario: public read-only share URL

- Status: OPEN
- Priority: P3
- Area: My Plan / Day Scenario
- Added: 2026-08-11
- Reason deferred: explicitly excluded from the Task 7 MVP ("Do NOT
  implement: public share URL"). The dead pre-existing `DayScenarioModal`
  (removed this task) only ever supported `navigator.share`/clipboard text
  export — never a real shareable URL/token.
- Context: `DayScenario` has no token/slug field, no public route exists.
  Sharing a Scenario today would require the recipient to already be
  logged in as the same user (no cross-user read path — by design, see
  Task 7 security requirements).
- Current state: not started.
- Dependencies: would need a new token-based public read path — a real,
  scoped security surface, not a trivial addition.
- Acceptance criteria: owner decision on scope before implementation.
- Source: `docs/release/dev-to-prod-checklist.md` Task 7 (Day Scenario)
  implementation, owner-approved MVP scope

## [BACKLOG-059] Day Scenario: recommendation insertion into timeline gaps

- Status: OPEN
- Priority: P3
- Area: My Plan / Day Scenario / Recommendations
- Added: 2026-08-11
- Reason deferred: explicitly excluded from the Task 7 MVP ("Do NOT
  implement: recommendations between activities"). Architecture-only
  extension point, not a first-release requirement per the owner's brief.
- Context: `detectScenarioConflictIds()` and the timeline already compute
  per-item time boundaries server-side, which is a reasonable future
  extension point for gap-detection — not wired to any recommendation
  source today.
- Current state: not started.
- Dependencies: none for extension-point compatibility; needs a real
  recommendation source decision before implementation.
- Acceptance criteria: owner decision before implementation.
- Source: `docs/release/dev-to-prod-checklist.md` Task 7 (Day Scenario)
  implementation, owner-approved MVP scope

## [BACKLOG-060] Day Scenario: travel-time / Google Routes integration

- Status: OPEN
- Priority: P3
- Area: My Plan / Day Scenario / Maps
- Added: 2026-08-11
- Reason deferred: explicitly excluded from the Task 7 MVP per the owner's
  cost-boundary instruction — no Google Routes/Distance Matrix calls on
  Scenario open/edit/save. Confirmed zero such calls exist anywhere in the
  implemented Scenario code path.
- Context: addresses already render via the reused
  `formatActivityAddressLine()`; no "Открыть маршрут в Google Maps"
  deep-link or travel-time estimate exists yet.
- Current state: not started.
- Dependencies: none blocking; future work should prefer a plain Maps URL
  deep-link over any paid Routes/Distance Matrix API call, per the owner's
  standing cost-boundary decision.
- Acceptance criteria: owner decision before implementation.
- Source: `docs/release/dev-to-prod-checklist.md` Task 7 (Day Scenario)
  implementation, owner-approved MVP scope

## [BACKLOG-061] Dead `src/features/me/` Day Scenario chain — finish or delete

- Status: OPEN
- Priority: P3
- Area: My Plan / Day Scenario / Dead code
- Added: 2026-08-11
- Reason deferred: not in Task 7's MVP scope; owner explicitly said not to
  bring `buildDayScenario()`/`DayScenarioBlock`/`ScenarioFinalPage`/
  `PlanCard` back into the live architecture just because they exist.
- Context: `src/features/me/lib/dayScenario.ts`'s `buildDayScenario()` is a
  permanent stub (`return null`); its only consumer chain
  (`DayScenarioBlock.tsx` → `PlanCard.tsx`) is reachable only from the
  internal `/ui-lab` component showcase (`src/components/ui-lab/
  registry.ts`), whose own `usedIn` metadata falsely claims usage in
  `/me/page.tsx` and `/me/day/[date]/page.tsx` (verified false by direct
  inspection — neither imports `PlanCard`). `ScenarioFinalPage.tsx` has
  zero importers anywhere. `src/features/me/lib/dayScheduler.ts`
  (`findPlacement()`) is a real, working conflict/placement algorithm but
  has no live caller once this chain is excluded (it was only reachable via
  the dead `useAddScenarioPlan` hook, itself only used by `DayScenarioBlock`).
- Current state: not started; left fully untouched by Task 7 as instructed.
- Dependencies: none blocking.
- Acceptance criteria: either finish this as a real feature (unlikely given
  Task 7 built a separate live implementation) or delete
  `dayScenario.ts`/`DayScenarioBlock.tsx`/`ScenarioFinalPage.tsx` and the
  stale `PlanCard` registry entry; also fix or remove the false `usedIn`
  claim in `src/components/ui-lab/registry.ts` regardless of which option
  is chosen. `dayScheduler.ts` may be worth keeping/reusing if BACKLOG-056
  (manual time editing / conflict-aware placement) is ever picked up.
- Source: `docs/release/dev-to-prod-checklist.md` Task 7 (Day Scenario)
  audit + implementation

## [BACKLOG-062] `/me/plan` shows "СНЯТО" for every Place/Article PlanItem

- Status: OPEN
- Priority: P2
- Area: My Plan
- Added: 2026-08-11
- Reason deferred: discovered incidentally during Task 7's real-DEV smoke;
  the affected code (`PlanDayList.tsx`'s `unavailable` badge,
  `getPlanActivityPublicAvailability`) was not touched by any Task 7
  commit — not a Task 7 regression, out of scope to fix during that task
  per its own "do not investigate unrelated known issues" instruction.
- Context: `getPlanActivityPublicAvailability()`
  (`src/lib/plan/publicVisibility.ts:6-17`) returns `"missing_activity"`
  whenever its `activity` argument is `null` — correct for a genuinely
  removed *Activity*-type PlanItem, but `PlanDayList.tsx`'s `PlanItemCard`
  always calls it with `item.activity`, which is structurally `null` for
  every Place-type and Article-type `PlanItem` (those reference
  `placeId`/`articleId`, not `activityId`) regardless of whether the
  underlying Place/Article is live and published. Reproduced live on real
  DEV: a freshly-saved, live, published Article and a freshly-saved, live,
  published Place both showed the "СНЯТО" (removed) badge on `/me/plan`.
- Current state: not started.
- Dependencies: none blocking.
- Acceptance criteria: `PlanItemCard`'s availability check should only
  apply (and only show "СНЯТО") for Activity-type items missing/disabled
  for a real reason; Place/Article-type items need either their own
  real availability check (mirroring `isPlacePubliclyVisible()`, which
  already exists and is correct) or simply no "СНЯТО" badge when there is
  no real Activity to check.
- Source: `docs/release/dev-to-prod-checklist.md` Task 7 (Day Scenario)
  real-DEV smoke, 2026-08-11

## [BACKLOG-063] `/[city]/classes`, `/[city]/birthday`, `/[city]/routes` have zero page-specific metadata

- Status: **DONE** (2026-08-12)
- Priority: P2
- Area: SEO / Structured Data (Task 8)
- Added: 2026-08-12
- Owner decision (2026-08-12): pulled back into Task 8's own implementation
  scope (directly relevant to Task 8's existing Exit Criteria), approved
  as minimal scope alongside BACKLOG-064. BACKLOG-065 stays deferred.
- Context: `src/app/(public)/[city]/classes/page.tsx`,
  `src/app/(public)/[city]/birthday/page.tsx`, and
  `src/app/(public)/[city]/routes/page.tsx` were thin `<CityShell
  intent="...">` wrappers with no `generateMetadata`/`metadata` export at
  all — confirmed by direct file read, all three contained only the
  `CityShell` render, nothing else. They inherited the root layout's
  static `metadata` (`src/app/layout.tsx`: title `"mamaGo 2.0"`,
  description `"Next Generation City Guide"`), identical across every
  active city × these 3 intents — duplicate title/description at scale.
- Resolution: added `buildCityClassesListingMetadata()`,
  `buildCityBirthdayListingMetadata()`, `buildCityRoutesListingMetadata()`
  to `src/lib/seo/cityKudaListingMetadata.ts`, following the exact
  `buildCityEventsListingMetadata`/`buildCityHubMetadata` pattern already
  in that file. Title reuses the same `DISCOVERY_INTENT_CONFIG[intent]
  .titleTemplate` + `formatCityTitle()` that already backs each page's own
  on-page `<H1>` (`CityDiscoveryShell.tsx`), so `<title>` can never drift
  from the visible heading. Description uses `getCityDisplayName()`
  (prepositional case, e.g. "в Минске") — an earlier draft used the DB
  `city.name` field (nominative, "Минск"), producing an ungrammatical "в
  Минск"; caught and fixed during browser verification before commit.
  Canonical via 2 new `CityPathType` entries (`"classes"`, `"birthday"`,
  plus `"programs"` for BACKLOG-064) added to the existing single-source-
  of-truth `buildCityPublicPath()`/`buildCityPublicUrl()`
  (`src/lib/routing/cityPaths.ts`) rather than hand-built strings. All 3
  pages' `generateMetadata()` wrap the result in
  `applyGlobalRobotsOverride()` explicitly (matching the safer
  `/[city]/events` pattern, not the fragile inheritance-only
  `/[city]/programs` pattern the audit flagged). No JSON-LD added (none
  needed for listing shells, per the approved scope).
- Tests: `src/lib/seo/cityKudaListingMetadata.test.ts` (new) — title
  matches the H1 template, canonical is absolute and correct, description
  non-empty, unknown city returns `{}` (no fabricated metadata), routes
  and classes titles don't collide, and — via the same subprocess
  env-isolation technique as `globalNoindex.test.ts` — all 3 pages'
  `generateMetadata()` resolve to noindex robots under the prelaunch
  default (no `SITE_INDEXING_ENABLED` set).
- Verification: `npx tsc --noEmit` clean; targeted `eslint` clean (0
  errors); `pnpm check:push` (`pnpm build`) exit 0, all 3 routes compiled.
  Browser-verified locally (`/minsk/classes`, `/minsk/birthday`,
  `/minsk/routes`): correct `<title>`, meta description, absolute
  canonical, and `noindex, nofollow` robots (prelaunch default, matching
  every other page — confirms the global override still wins).
- Source: `docs/release/dev-to-prod-checklist.md` Task 8 (Schema.org /
  Structured Data), audited 2026-08-12, implemented 2026-08-12

## [BACKLOG-064] `sitemap.xml` omits several real listing page types; doesn't check per-entity `seoRobots`

- Status: **DONE** (2026-08-12)
- Priority: P2
- Area: SEO / Structured Data (Task 8)
- Added: 2026-08-12
- Owner decision (2026-08-12): pulled back into Task 8's own implementation
  scope alongside BACKLOG-063, with an explicitly bounded gap list (see
  below) — no `/[city]/birthday` entry, per owner instruction (its
  discovery feed currently reuses kuda/event content, a separate
  pre-existing product issue, not addressed by this change).
- Context: `src/app/sitemap.ts` included city hub, `/[city]/events`,
  per-city discovery tags, and detail pages for Place/Offer/Route/Article/
  Event, but not `/[city]/programs`, `/[city]/classes`, `/[city]/routes`
  (city listing), `/routes` (global), `/blog`, or `/[city]/blog`.
  Separately, Event/Place/Offer/Route sitemap entries were filtered only
  by publish status/visibility, never by the per-entity `seoRobots`
  string field — an admin-set `seoRobots="noindex,nofollow"` override
  still got a sitemap entry even though the entity's own page rendered
  `noindex`. Article was already correctly excluded via its `noindex`
  boolean (unchanged, not touched).
- Resolution: added the approved 6 listing URLs (global `/routes`,
  `/blog`, once each; per active city `/{city}/programs`,
  `/{city}/classes`, `/{city}/routes`, `/{city}/blog`) to
  `src/app/sitemap.ts`, all built via the existing
  `buildCityPublicPath()`/`buildCityPublicUrl()` single source of truth
  (extended with 2 new `CityPathType` entries, `"classes"`/`"birthday"`,
  plus `"programs"` — no hand-built alternate URL format). Added a new
  `hasNoindexRobots()` predicate (same comma-separated
  `parts.includes("noindex")` semantics as the existing per-page
  `parseRobots()` helpers in the Event/Offer detail pages) and applied it
  as an in-memory post-fetch filter (not a raw SQL `NOT: {contains}`
  clause, which would silently exclude every row with `seoRobots IS NULL`
  under three-valued SQL logic — deliberately avoided) to the
  Place/Offer/Route/Event sitemap queries, each now also selecting
  `seoRobots`. Dataset is small (~276 published entities per the Task 8
  audit), so this stays a single bounded query per entity type, no N+1.
  Article intentionally left untouched (out of the owner-approved gap
  list; already correctly filtered via its `noindex` boolean).
- Tests: `src/app/sitemap.test.ts` (new) — unit-tests `hasNoindexRobots()`
  directly (case-insensitivity, comma-separated parsing, null/empty
  handling), then an end-to-end integration test with 2 disposable real
  `Place` fixtures (one plain, one `seoRobots: "noindex,nofollow"`,
  cleaned up in a `finally` block): confirms the global + all 4 per-city
  new listing URLs are present, `/{city}/birthday` is correctly absent,
  the plain fixture's URL is present, the noindexed fixture's URL is
  absent, no duplicate URLs, every URL absolute/well-formed. Exercises
  `sitemap()` with `SITE_INDEXING_ENABLED=true` set in-process (its
  default-noindex short-circuit behavior is already covered by
  `globalNoindex.test.ts`, not re-tested here).
- Verification: `npx tsc --noEmit` clean; targeted `eslint` clean (0
  errors); `pnpm check:push` (`pnpm build`) exit 0, `/sitemap.xml`
  compiled. Browser-verified locally: `/sitemap.xml` resolves cleanly
  (empty `<urlset>` under the local prelaunch-default noindex flag —
  correct, same safety behavior as `/robots.txt`); full content
  correctness proven by the automated integration test above (indexing
  can't safely be toggled on for a live local browser check without
  restarting the dev server under a different env, which the test
  already covers end-to-end).
- Source: `docs/release/dev-to-prod-checklist.md` Task 8 (Schema.org /
  Structured Data), audited 2026-08-12, implemented 2026-08-12

## [BACKLOG-065] Minor Schema.org / SEO enrichment opportunities (grab-bag)

- Status: OPEN
- Priority: P3
- Area: SEO / Structured Data (Task 8)
- Added: 2026-08-12
- Reason deferred: all confirmed real but cosmetic/enrichment-only, none
  affect current Rich Results validity or indexability.
- Context (each independently actionable, grouped only for backlog
  hygiene):
  1. `WebSite` JSON-LD's `potentialAction.SearchAction` is never
     populated — `buildWebSiteJsonLd()` supports a `searchPath` input but
     `src/app/(public)/layout.tsx`'s call site never passes one. Passing
     `/search` (or the real search route once it's server-renderable,
     see item 3) would enable Google Sitelinks Search Box.
  2. `.env.example` lines 47-49 tell operators "Production launch: set
     `SITE_NOINDEX_DEFAULT=false` so search engines can index the site" —
     this is misleading: `isGlobalNoindexEnabled()`
     (`src/lib/seo/globalNoindex.ts:25-30`) only turns indexing on via
     `SITE_INDEXING_ENABLED=true`; `SITE_NOINDEX_DEFAULT=false` alone does
     nothing (falls through to the default-noindex `return true`). The
     real, correct flag is already used consistently in
     `docs/migration/production-cutover-runbook.md` and
     `docs/migration/dns-cutover-plan-2026-07-29.md` — this is a stale/
     wrong comment in the example env file only, not a live-config risk,
     but worth a one-line fix so a future operator following only
     `.env.example` doesn't launch permanently noindexed.
  3. `src/app/(public)/search/page.tsx` is a `"use client"` component that
     JS-redirects (`router.replace`) to `/{citySlug}` on mount — no
     server-side metadata or redirect, so a crawler fetching it
     server-side gets an empty shell, not a 30x. Low risk unless
     something links to `/search` publicly (not confirmed either way);
     converting to a server redirect would be a trivial, safe fix if ever
     prioritized.
  4. `buildOgMeta()` always sets `openGraph.type: "website"`, even for
     Article/Event/Offer detail pages (Facebook/LinkedIn recommend
     `"article"` for articles, with `article:published_time` etc.) — a
     social-share preview quality gap, not a Google Rich Results
     requirement.
  5. `Event`/`Place` JSON-LD emit `location.address`/`address` as a plain
     string rather than a structured `PostalAddress` (`streetAddress`,
     `addressLocality`, etc.) — valid per schema.org (address accepts a
     string), but Google's Event/Place Rich Results guidance recommends
     structured `PostalAddress` for the richest eligible presentation.
  6. `buildEventJsonLd()` never emits an `offers` node (price), even when
     the underlying session/Activity has a real price — Google's Event
     Rich Results recommend (not require) `offers` when ticketing/pricing
     exists.
  7. Global `Organization`/`WebSite` JSON-LD (`(public)/layout.tsx`) is
     emitted on every page in the `(public)` route group, including
     auth-gated `/me/*` pages and explicitly-noindex pages (e.g. the Day
     Scenario page) — confirmed harmless (generic, non-personal data,
     doesn't affect indexability since those pages are noindex/auth-gated
     regardless), but flagged per Task 8's own "structured data inherited
     accidentally from layouts" check. No action needed unless the owner
     wants layout-level suppression on noindex routes for cleanliness.
- Current state: not started.
- Dependencies: none blocking.
- Acceptance criteria: each sub-item can be picked up independently; none
  block PROD.
- Source: `docs/release/dev-to-prod-checklist.md` Task 8 (Schema.org /
  Structured Data) audit, 2026-08-12

## [BACKLOG-066] `/[city]/birthday` renders kuda/event content, not birthday-specific content

- Status: OPEN
- Priority: P3
- Area: Discovery / Birthday section
- Added: 2026-08-12
- Reason deferred: incidentally noticed while implementing BACKLOG-063
  (birthday page metadata); already self-documented in code as a known
  defect, not caused by and out of scope for Task 8 (metadata-only task).
  Not fixed here per this task's own "do not expand beyond the approved
  scope" instruction.
- Context: `src/components/city/CityShell.tsx` (~line 65) has an inline
  comment marked `DEFECT (not a TODO)`: `intent === "birthday"` currently
  reuses `getKudaDiscoveryFeed()` and renders Event/kuda discovery content
  — not birthday-specific content. The comment states the correct
  architecture needs a separate feed built on `PartyCategory`/
  `PartyOccasion`/`PartyLocationType` and `PARTY_SERVICE`/
  `PARTY_PACKAGE` Offer rows, none of which have a read-side consumer
  today. Also relevant: `DISCOVERY_INTENT_CONFIG.birthday` has
  `navigationEnabled: false, comingSoon: true` — this section is not yet
  promoted in primary navigation, consistent with it being unfinished.
  Task 8's BACKLOG-063 gave this page real, topic-appropriate metadata
  (title/description about children's birthday party organization)
  matching its intended purpose and URL — but the actual on-page content
  still doesn't match that topic yet, a pre-existing product gap.
- Current state: not started.
- Dependencies: none blocking.
- Acceptance criteria: either build the real birthday-specific discovery
  feed described in the `CityShell.tsx` comment, or keep the page
  `comingSoon`/unpromoted until that feed exists.
- Source: `docs/release/dev-to-prod-checklist.md` Task 8 (Schema.org /
  Structured Data) implementation, 2026-08-12

## [BACKLOG-067] Remove the dead parallel discovery-filter stack after Task 9

- Status: OPEN
- Priority: P3
- Area: Discovery / Cleanup
- Added: 2026-08-12
- Reason deferred: harmless dead-code cleanup; Task 9 is audit-only and the
  release-relevant work is correcting the currently visible live controls, not
  deleting inactive experiments.
- Context: `src/features/discovery/filters/*` implements a second Zustand +
  global-localStorage filter store; `src/components/discovery/FilterMasonryMenu.tsx`,
  `src/lib/discovery/urlState.ts`, and
  `src/server/discovery/getActivityFeed.ts` form a differently-shaped
  FilterDefinition/ActivityFilterOption query path. Repository-wide consumer
  tracing found no public runtime call site; `FilterMasonryMenu` is listed only
  in UI Lab. The live stack is `src/features/filters/discovery/*` plus
  `CityShell`/`DiscoveryActivitiesGrid`.
- Current state: not started; leave untouched until the approved Task 9 live
  path is stable, then re-run consumer tracing before deletion.
- Dependencies: Task 9 implementation/verification.
- Acceptance criteria: prove no runtime/import consumer on current HEAD, remove
  the dead store/menu/parser/feed together, and keep the canonical URL-based
  live filter stack green.
- Source: `docs/release/dev-to-prod-checklist.md` Task 9 audit (Filters & Quick
  Access), 2026-08-12.

## [BACKLOG-068] Add real coordinate/radius Nearby filtering

- Status: OPEN
- Priority: P3
- Area: Discovery / Geography
- Added: 2026-08-12
- Reason deferred: Task 9 explicitly chooses the smallest safe MVP and must not
  add proximity infrastructure. The former “Nearby” control only constrained
  format to offline/hybrid, so Task 9 hides it and ignores stale `nearby` URLs.
- Current state: no executable proximity semantics in public discovery.
- Dependencies: a product-defined origin (device or selected point), radius,
  consent/fallback behavior, and a bounded coordinate query design.
- Acceptance criteria: filter by real coordinates and radius, document boundary
  and missing-coordinate behavior, add query/performance tests, then restore the
  control with accurate copy.
- Source: `docs/release/dev-to-prod-checklist.md` Task 9 implementation (Filters
  & Quick Access), 2026-08-12.

## [BACKLOG-069] Classify legacy records with missing age provenance

- Status: OPEN
- Priority: P2
- Area: Content data / Age semantics
- Added: 2026-08-12
- Reason deferred: Task 10 must establish truthful typed semantics for new
  edits, but legacy rows with no age tags/range cannot be automatically
  classified as deliberately unrestricted versus simply unknown. Text matching
  is not authoritative enough for an automatic release-blocking backfill.
- Context: `Activity.ageTags=[]` plus null month bounds is currently both a
  runtime unrestricted fallback and the default/absence state. The WordPress
  normalizer preserves `ageEvidence`, including textual `18+`, in normalized
  migration evidence, but the Phoenix `EventCommitWriter` does not persist that
  evidence into Activity age fields. A bounded actual-DEV census was attempted
  during Task 10 audit; after the DEV DB identity was confirmed, the SSH
  endpoint became unavailable, so row counts remain unproven rather than
  guessed.
- Current state: rows with valid structured age values can be classified
  mechanically as age-specific during Task 10; empty legacy rows must remain
  `UNKNOWN`. Text-only `18+` rows need a reviewed correction manifest, not
  regex writes.
- Dependencies: owner approval and implementation of Task 10's canonical
  age-policy model.
- Acceptance criteria: capture a read-only DEV census; export text-only,
  malformed, and contradictory candidates to a bounded review manifest;
  correct approved rows idempotently; never silently promote unknown rows to
  unrestricted or adult-only.
- Source: `docs/release/dev-to-prod-checklist.md` Task 10 audit, 2026-08-12.

## [BACKLOG-070] Add explicit acquisition and visit attribution telemetry

- Status: OPEN
- Priority: P2
- Area: Analytics / Acquisition
- Added: 2026-08-12
- Reason deferred: Task 12 must remain a factual CEO overview over existing
  telemetry; changing the event/session model and registration flow is a
  separate analytics architecture task.
- Context: `UserEvent.sessionId` is a stable browser identity stored in
  localStorage, not a bounded visit/session. `User.createdAt` also does not
  distinguish a public registration from imports, test/service accounts, or
  admin-created users, and no registration event carries source attribution.
  Therefore visits and registration conversion cannot be stated honestly.
- Current state: Task 12 labels stable browser identities as tracked visitors,
  labels `User.createdAt` counts as new accounts, and renders registration
  conversion unavailable.
- Dependencies: product definitions for visit timeout, acquisition source, and
  which account-creation paths count as registrations.
- Acceptance criteria: emit an explicit registration event with durable source
  attribution; model bounded visits separately from stable visitor identity;
  document bot/internal traffic handling; back metrics with focused tests and
  reconcile them against direct DB queries.
- Source: `docs/release/dev-to-prod-checklist.md` Task 12 analytics audit,
  2026-08-12.

## [BACKLOG-072] Post-launch financial platform hardening and billing cleanup

- Status: OPEN
- Priority: P2
- Area: Billing / Finance
- Added: 2026-08-13
- Reason deferred: Task 13 first-PROD scope is deliberately limited to manual
  verified top-up, explicit paid Boost, safe reversal and deterministic
  reconciliation. The items below are useful but not required for that narrow
  safe launch model.
- Context: deferred work includes immutable-ledger DB policy and financial
  retention; scheduled reconciliation/alerting; Decimal/minor-unit arithmetic
  cleanup; provider refund workflow; durable financial outbox and operations
  monitoring; legacy Plan/Subscription/Placement cleanup; mock requisites
  cleanup; transaction-history export/advanced filters; promo credits/coupons;
  and advanced financial analytics/invoices.
- Current state: Task 13 supplies a signed ledger, cached balance, read-only
  reconciliation command, idempotent manual writes and Boost purchases. Online
  payment/provider refund, bonus currencies and advanced accounting remain
  intentionally absent.
- Dependencies: Task 13 completion and real post-launch operational evidence;
  provider work additionally requires a separately approved provider.
- Acceptance criteria: split this umbrella only when an item is scheduled;
  fresh-audit the then-current billing model; preserve ledger traceability and
  idempotency; do not introduce bonus wallets or automated money movement
  without an explicit product/legal decision.
- Source: Task 13 Phase A findings and owner-approved Phase B scope.

## [BACKLOG-071] Build acquisition cohorts for D1/D7/D30 retention

- Status: OPEN
- Priority: P2
- Area: Analytics / Retention
- Added: 2026-08-12
- Reason deferred: the available event history is short and there is no
  trustworthy acquisition cohort marker, so a retention percentage in Task 12
  would create false precision.
- Context: current telemetry can identify authenticated users active before a
  selected period (returning users), but cannot assign every user or anonymous
  visitor to a reliable first-acquisition cohort. Stable browser IDs are also
  not visits and can be cleared or replaced by clients.
- Current state: Task 12 shows returning authenticated users and an explicit
  `Retention: недостаточно данных` state instead of D1/D7/D30.
- Dependencies: BACKLOG-070 and enough post-launch telemetry history to mature
  the requested cohorts.
- Acceptance criteria: define cohort entry and active-return semantics;
  implement D1/D7/D30 on mature cohorts only; separate authenticated and
  anonymous populations; add timezone-boundary, empty-cohort, and denominator
  tests plus direct DB reconciliation.
- Source: `docs/release/dev-to-prod-checklist.md` Task 12 analytics audit,
  2026-08-12.

## [BACKLOG-073] Public Prisma Studio on Traefik (`studio.dev` / `studio.prod`)

- Status: OPEN
- Priority: P2
- Area: Environment / Security
- Added: 2026-08-13
- Reason deferred: does not block first PROD of the application itself; Studio
  is basic-auth gated. Still an internet-facing DB GUI on the same host.
- Context: compose labels publish `studio.dev.mamago.by` and
  `studio.prod.mamago.by` via Traefik `websecure`. Live probe: HTTP 401 +
  `WWW-Authenticate: Basic`. DEV and PROD use the same basic-auth users hash.
- Current state: both `dev-prisma-studio-1` and `prod-prisma-studio-1` are Up.
- Dependencies: none.
- Acceptance criteria: Studio is not publicly routed on PROD (or is IP-restricted
  with unique credentials); DEV/PROD basic-auth secrets are independent.
- Source: Task 14 Phase A environment audit

## [BACKLOG-074] Host env-file hygiene on `/opt/mamago/dev` and leftover NEXTAUTH keys

- Status: OPEN
- Priority: P2
- Area: Environment / Secrets
- Added: 2026-08-13
- Reason deferred: not a first-PROD application-config blocker; current code
  does not read `NEXTAUTH_*`.
- Context: DEV `.env` is mode `0777`; several `.env.bak-*` copies exist in
  `/opt/mamago/dev`. Persistent env still contains unused `NEXTAUTH_SECRET` /
  `NEXTAUTH_URL` (DEV vs PROD secret SAME).
- Current state: observed 2026-08-13; files not modified this audit.
- Dependencies: none.
- Acceptance criteria: DEV `.env` is not world-writable; stale backups removed
  or locked down; unused NextAuth keys removed from both env files after
  confirming no remaining runtime reader.
- Source: Task 14 Phase A environment audit

## [BACKLOG-075] PROD Postgres published on `0.0.0.0:5432`

- Status: OPEN
- Priority: P2
- Area: Environment / Database
- Added: 2026-08-13
- Reason deferred: laptop TCP probe to `134.17.17.134:5432` was
  FILTERED/CLOSED, so this is not a proven internet-open P0. Compose still
  publishes the port; DEV does not.
- Context: `/opt/mamago/prod/docker-compose.yml` `ports: ["5432:5432"]` on
  `prod-db-1`. Host `ss` shows listen on `0.0.0.0:5432` and `[::]:5432`.
  UFW/iptables were not readable without sudo.
- Current state: internet-filtered from auditor laptop; still an unnecessary
  publish surface.
- Dependencies: none. Do not change live PROD compose without a dedicated
  maintenance window (would recreate the DB container if done carelessly).
- Acceptance criteria: PROD DB is not published on the public interface;
  access remains on `prod_prod_net` only.
- Source: Task 14 Phase A environment audit

## [BACKLOG-076] Dual Google Map ID env names (`NEXT_PUBLIC_GOOGLE_MAP_ID` vs `..._MAPS_MAP_ID`)

- Status: OPEN
- Priority: P2
- Area: Google Maps / Build-time config
- Added: 2026-08-13
- Reason deferred: Maps JavaScript API still loads via
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; AdvancedMarker in some wizards reads a
  different Map ID name than Dockerfile/GHA bake.
- Context: Docker/GHA bake `NEXT_PUBLIC_GOOGLE_MAP_ID`. Place/Event map
  components read `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`. `RouteMapHero` reads
  `NEXT_PUBLIC_GOOGLE_MAP_ID`.
- Current state: first-PROD maps depend on the baked API key (P1/build), not
  on unifying Map ID names.
- Dependencies: none.
- Acceptance criteria: one Map ID env name used by Dockerfile, GHA, and all
  map components.
- Source: Task 14 Phase A environment audit

## [BACKLOG-077] Leftover `/api/debug/media-usage` is reachable in production for ADMIN

- Status: OPEN
- Priority: P2
- Area: Security / Debug
- Added: 2026-08-13
- Reason deferred: ADMIN-gated, does not expose env secrets; still a debug
  endpoint that should not ship.
- Context: `src/app/api/debug/media-usage/route.ts` has no `NODE_ENV`
  production 404. `/api/debug/cookies` correctly 404s when
  `NODE_ENV=production`.
- Current state: present on `origin/dev`.
- Dependencies: none.
- Acceptance criteria: endpoint removed or hard-404 outside local development.
- Source: Task 14 Phase A environment audit

## [BACKLOG-078] No scheduler invokes `/api/cron/*`; `CRON_SECRET` MISSING

- Status: OPEN
- Priority: P2
- Area: Cron / Jobs
- Added: 2026-08-13
- Reason deferred: first PROD can run without plan-digest / reminders /
  broadcast auto-publish / temp-media cleanup. Current code fail-closes cron
  routes in `NODE_ENV=production` without `CRON_SECRET` (503).
- Context: four routes under `src/app/api/cron/`. Host has no user crontab,
  no ofelia/watchtower, no app timers. Distinct from BACKLOG-035 (behavior
  segment recompute has no caller).
- Current state: DEV and PROD persistent `CRON_SECRET=MISSING`.
- Dependencies: product decision which jobs are required post-launch.
- Acceptance criteria: each first-needed job has exactly one scheduler, a
  per-environment `CRON_SECRET`, and no dual DEV+PROD firing at the same
  target.
- Source: Task 14 Phase A environment audit

## [BACKLOG-079] `NEXT_PUBLIC_APP_URL` is not a Docker build-arg

- Status: OPEN
- Priority: P2
- Area: Docker / Canonical URLs
- Added: 2026-08-13
- Reason deferred: many helpers fall back to `https://mamago.by` when the
  public var is unset at build, which is the desired PROD origin. Runtime
  `APP_PUBLIC_URL` covers emails/`getCanonicalPublicAppUrl`. Not a silent
  DEV-URL bake into PROD today because GHA does not pass this ARG.
- Context: Dockerfile bakes only Google Maps `NEXT_PUBLIC_*`. Canonical sync
  (`syncEntityCanonical.ts`) reads `NEXT_PUBLIC_APP_URL` directly.
- Current state: DEV/PROD persistent env set `APP_PUBLIC_URL` but not
  `NEXT_PUBLIC_APP_URL`.
- Dependencies: owner-chosen first-PROD public origin (Task 14 Phase B).
- Acceptance criteria: PROD image build receives the intended public origin
  for any client/middleware inlined `NEXT_PUBLIC_APP_URL`, or those call
  sites are switched to a runtime-safe helper. Never bake `dev.mamago.by`
  into a PROD image.
- Source: Task 14 Phase A environment audit

## [BACKLOG-080] `RouteMapHero` still uses legacy `DirectionsService`/`DirectionsRenderer`

- Status: OPEN
- Priority: P3
- Area: Google Maps / Routes
- Added: 2026-08-13
- Reason deferred: not release-blocking — `renderDirections()` already wraps
  the legacy Directions call in try/catch and silently falls back to a plain
  `Polyline` between stops on any failure (including a Directions API not
  enabled/blocked error), so there is no unhandled runtime error and no
  console spam on the public route detail page. The fallback just draws a
  straight line instead of the actual walking/driving path.
- Context: `src/components/routes/RouteMapHero.tsx` (`renderDirections`).
  Routes API (New) is already enabled on the mamaGo 2.0 Google Cloud project;
  a proper migration would call the Routes API's `computeRoutes` endpoint
  instead of `google.maps.DirectionsService`.
- Current state: legacy Directions path live in production code, silent
  polyline fallback in place.
- Dependencies: none.
- Acceptance criteria: `RouteMapHero` renders an actual routed polyline via
  Routes API (New) instead of the straight-line fallback, with the same
  graceful degradation on failure.
- Source: Task 14 Google Maps/Places P1 audit

## [BACKLOG-081] Legacy `google.maps.Marker` fallback still present in map components

- Status: OPEN
- Priority: P3
- Area: Google Maps / Places
- Added: 2026-08-13
- Reason deferred: harmless now that BACKLOG-079-adjacent Map ID env fix
  (Task 14 Google P1) landed — `NEXT_PUBLIC_GOOGLE_MAP_ID` resolves correctly
  everywhere, so `AdvancedMarkerElement` is the live path in all four map
  components and the legacy `google.maps.Marker` branch is dead-but-harmless
  defensive code for the case `mapId` is ever unset again in some future
  environment.
- Context: `PlaceMapModal.tsx`, `PlaceMapPreview.tsx`,
  `EventLocationMapModal.tsx`, `EventLocationMapPreview.tsx` all branch on
  `mapId ? AdvancedMarkerElement : google.maps.Marker`.
- Current state: fallback branch present, not currently reachable in a
  correctly configured environment.
- Dependencies: none.
- Acceptance criteria: product/eng decision on whether to keep the defensive
  fallback permanently or remove it now that the env contract is fixed; if
  removed, delete the fallback branch in all four components together.
- Source: Task 14 Google Maps/Places P1 audit

## [BACKLOG-082] Deploy-critical compose files not version-controlled

- Status: OPEN
- Priority: P2
- Area: Deployment / Git
- Added: 2026-08-13
- Reason deferred: not a blocker for the first PROD preview itself — the
  runbook documents the read-only commands to inspect the host's actual
  compose/env state at pre-flight time — but it is a real, standing gap for
  safe long-term operation.
- Context: `/opt/mamago/dev/docker-compose.yml` and
  `/opt/mamago/prod/docker-compose.yml` (confirmed to exist via `docker
  inspect` compose-project labels during Task 15's audit) live only on the
  deploy host, not in this git repo. `docker-compose.yml` at the repo root
  is a local-dev-only file (`mamago2-db`/`mamago2-app` container names,
  ports `5433`/`3000`) and does not reflect the real DEV/PROD stacks, which
  additionally run a one-shot `*-migrate-1` service and `prisma-studio`
  that the repo-root file doesn't define at all. No diff-reviewable record
  exists of compose changes on the host, and dev/prod compose drift can
  only be detected via SSH, not via git.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: a redacted compose template (or the real files with
  secrets externalized to `.env`, never committed) checked into the repo
  under version control, kept in sync with the host on every intentional
  change, so compose changes go through the same review path as code.
- Source: Task 15 audit (Deployment & Rollback Readiness)

## [BACKLOG-083] Stale Phoenix/migration containers and images on the shared DEV+PROD host

- Status: OPEN
- Priority: P2
- Area: Ops / Disk
- Added: 2026-08-13
- Reason deferred: safe-looking prune candidates, but Task 15 is a
  read-only audit — deleting containers/images on the live shared host is
  out of scope without owner confirmation these aren't intentionally kept.
- Context: on `134.17.17.134` (confirmed via `docker ps -a`/`docker
  images`): `phoenix-dev-rerun-c53d380cc4a2`, `phoenix-dev-rerun-0e35d863ebdf`,
  `phoenix-dev-continue-apply-0e35d863ebdf` (all `Exited`, 9 days old,
  outside the `dev`/`prod` compose projects) plus their images
  `mamago2-migrate:phoenix-c53d380cc4a2` / `mamago2-migrate:phoenix-0e35d863ebdf`
  (~2.14GB each); `prod-migrate-1` (`Exited`, 5 weeks old, superseded by
  the next PROD migration run); `docker system df` also reports 1.386GB
  already dangling. Meaningful reclaim on a filesystem with only 8.8GB
  free out of 28GB.
- Current state: not started, nothing removed.
- Dependencies: owner confirmation these aren't intentionally retained for
  reference/debugging (the Phoenix ones correspond to
  `recovery/phoenix-pr102-rerun-skip` — see BACKLOG-002).
- Acceptance criteria: owner-approved `docker rm`/`docker rmi` of the
  confirmed-safe candidates, or a documented reason to keep each one.
- Source: Task 15 audit (Deployment & Rollback Readiness)

## [BACKLOG-084] No Docker HEALTHCHECK on app containers

- Status: OPEN
- Priority: P3
- Area: Deployment / Reliability
- Added: 2026-08-13
- Reason deferred: `/api/health` (checks DB connectivity) already exists
  and is usable for manual/external smoke checks; the gap is only that
  Docker itself has no automatic health signal to act on (e.g. for
  restart-on-unhealthy policies).
- Context: neither `Dockerfile` nor the repo-root `docker-compose.yml`
  define a `HEALTHCHECK`; confirmed on the live host that `prod-app-1`/
  `dev-app-1` report `Health=n/a` in `docker inspect`, unlike `prod-db-1`/
  `dev-db-1` (postgres image ships its own healthcheck, reports
  `healthy`).
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: add a `HEALTHCHECK` to `Dockerfile` (e.g. `curl -f
  http://localhost:3000/api/health`) so `docker ps`/orchestration tooling
  can see app health directly, not just container-alive status.
- Source: Task 15 audit (Deployment & Rollback Readiness)

## [BACKLOG-085] `scripts/deploy/backup-remote-db.sh` needs a live end-to-end test

- Status: **DONE** (2026-08-13)
- Priority: P1 (was — resolved, no longer a release blocker)
- Area: Deployment / Backup
- Added: 2026-08-13
- Reason deferred (historical): not a code gap — the script was written,
  `bash -n`-clean, and manually reviewed — but SSH to `134.17.17.134` was
  intermittent throughout Task 15's session (worked briefly, then
  repeatedly timed out) and no live run against a real container
  completed. An unverified backup script should not be trusted as the
  safety net for a real PROD migration.
- Context: `scripts/deploy/backup-remote-db.sh` (new, Task 15) streams
  `pg_dump` over SSH straight into a local file so the dump never touches
  the host's disk.
- **Resolution evidence (2026-08-13, this session):**
  - SSH to `mamago-prod` was stable this session
    (`ssh -o ConnectTimeout=10 mamago-prod "echo SSH_OK"` succeeded
    immediately).
  - Live backup run: `scripts/deploy/backup-remote-db.sh mamago-prod
    dev-db-1 /tmp/mamago-backup-test` — exit 0. Produced
    `dev-db-1-20260813-204438.sql.gz` (810K/829766 bytes), non-empty,
    `gzip -t` integrity valid, `.sha256` checksum file present and
    `shasum -a 256 -c` verified OK.
  - Dump content confirmed to be a genuine, complete PostgreSQL dump (not
    error output): starts with `-- PostgreSQL database dump --`, ends
    with `-- PostgreSQL database dump complete --`, 155 `CREATE TABLE`
    statements matching 155 `COPY` statements, 22166 total lines.
  - Confirmed nothing was written to the remote host's disk: no `.sql*`
    files newer than 10 minutes anywhere under `/tmp`, `/root`, `/home`
    on the host or inside the `dev-db-1` container; `df -h /` unchanged
    (18G used / 8.8G free — identical to Task 15's recorded baseline).
  - **Restore path tested against a disposable, throwaway local
    container** (`postgres:16-alpine`, name
    `mamago-backup-restore-test-<pid>`, port 5544 — never the real local
    `mamago2-db` dev container, never DEV/PROD): restore via
    `gunzip -c <dump> | docker exec -i <disposable> sh -c 'psql -U
    "$POSTGRES_USER" -d "$POSTGRES_DB"'` completed with exit 0, zero
    `ERROR` lines in the restore log. Post-restore verification: 155
    tables in `information_schema.tables`, all expected core tables
    present (`User`, `Place`, `Event`/`Activity`, `City`), sanity row
    counts read back correctly (567 `User`, 5 `City`, 81 `Place` —
    consistent with the dataset counts observed during Task 16's audit).
    Disposable container removed immediately after (`docker rm -f`),
    confirmed gone from `docker ps -a`.
  - No code fix was needed — the script worked exactly as documented on
    the first live run. No PROD migration, PROD deploy, PROD DB change,
    or restore against DEV/PROD was performed.
- Dependencies: none remaining.
- Acceptance criteria: met in full — live non-empty checksummed backup
  confirmed, restore confirmed working against a disposable DB.
- Source: Task 15 audit (Deployment & Rollback Readiness); closed by a
  dedicated live-verification session (2026-08-13, post-Task 16).

## [BACKLOG-086] Disk headroom on shared DEV+PROD host — extend before full media/content migration or cutover

- Status: DONE (2026-08-14) — owner-executed LVM extension verified
  read-only this session; no further disk work required before Phoenix
  PROD import from a capacity standpoint.
- Priority: P2 — was a mandatory prerequisite before full media/content
  migration; prerequisite is now met.
- Area: Infrastructure / Disk
- Added: 2026-08-13
- Closed: 2026-08-14
- Reason deferred: originally confirmed real by Task 15's read-only host
  audit, out of Task 15's own scope (first-PROD preview had no
  media/content import). Owner later performed the local LVM extension.
- Context: `134.17.17.134` (DEV+PROD shared host) was a 28.2G LV with
  8.8G free on a 100G disk (`vda3` only 28.2G partitioned). Extension
  target was owner-approved 80G.
- Current state: verified 2026-08-14 via SSH `mamago-prod` (read-only):
  `/dev/vda` 100G; `/dev/vda3` 98.2G; `ubuntu--vg-ubuntu--lv` **80G**
  (`lsblk`); root `/` **79G** total, **16G used / 61G free** (`df -h`);
  `prod-app-1`/`prod-db-1`/`dev-app-1`/`dev-db-1` healthy,
  `RestartCount=0`. `vgs`/`lvs` were not re-read (no non-interactive
  sudo); `lsblk` already shows the 80G LV. Remaining ~18G VG free space
  is unused reserve, not a gap.
- Dependencies: none remaining.
- Acceptance criteria: met — root filesystem is the owner-approved 80G
  target, verified read-only (`df -h`, `lsblk`) before any full Phoenix
  media/content migration.
- Source: Task 15 audit; closed by Phoenix FULL PROD preflight
  (2026-08-14) against the already-extended live host.

## [BACKLOG-087] No rate limiting on password-reset request

- Status: OPEN
- Priority: P2
- Area: Security / Auth
- Added: 2026-08-13
- Reason deferred: does not block first PROD — unlike the missing register
  rate limit (fixed directly, see Task 16), this endpoint doesn't leak
  account existence (always returns the same success message) and the
  reset token is single-use with a short expiry, so the residual risk is
  email-bombing/abuse cost, not enumeration or auth bypass.
- Context: `src/server/auth/password-reset.ts` (`requestPasswordReset`) /
  `src/app/(auth)/forgot-password/actions.ts` (`forgotPasswordAction`) have
  no `checkRateLimit` call, unlike `/api/auth/login`,
  `/api/auth/register` (Task 16 fix), and `/api/auth/phone/verify-otp`.
- Current state: not started.
- Dependencies: none — same `checkRateLimit` pattern as the other three
  endpoints (`src/lib/security/rateLimit.ts`).
- Acceptance criteria: add a per-IP+email rate limit to the reset-request
  path, consistent with the existing pattern.
- Source: Task 16 audit (Final Release Safety Audit)

## [BACKLOG-088] No timeout/AbortController on Google Places, Telegram, SMS.BY fetches

- Status: OPEN
- Priority: P2
- Area: Reliability / External APIs
- Added: 2026-08-13
- Reason deferred: real robustness gap, but bounded impact — Google Places
  calls are on-demand, admin/business-only, and fail safe (return `null`
  → 404); Telegram sends are fire-and-forget on every critical path
  (booking, direct messages) so they can't block those responses. The one
  path with a synchronous await on an un-timed external call in a
  public-reachable flow is SMS OTP send/verify (business phone
  verification, not primary login) — worst case is a single hung
  request/spinner for the calling user, not a systemic outage.
- Context: `src/lib/google-places/client.ts:43,140`,dispatch in
  `src/server/services/telegram/TelegramChannel.ts:61`,
  `src/lib/sms/smsBy.ts:53` all call `fetch` with no `AbortSignal`/timeout.
  `src/server/egr/lookupByUnp.ts:26-33` already does this correctly (8s
  `AbortController`) — same pattern should be applied to the three above.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: add `AbortSignal.timeout(8000–10000)` (or
  equivalent) to the three fetches above, following the existing EGR
  pattern.
- Source: Task 16 audit (Final Release Safety Audit)

## [BACKLOG-089] `sitemap.xml` is force-dynamic with no cache — unbounded per-request scan across 5 tables

- Status: OPEN
- Priority: P2
- Area: Performance / SEO
- Added: 2026-08-13
- Reason deferred: harmless at current dataset size (small row counts
  across Place/Offer/Route/Article/Activity) and the first-PROD preview is
  noindex, so it won't actually be crawled at volume. Becomes a real cost
  concern once real content volume and real crawler traffic exist.
- Context: `src/app/sitemap.ts:39-300` sets `export const dynamic =
  "force-dynamic"`, so `/sitemap.xml` re-runs full `findMany` queries
  across `Place`, `Offer`, `Route`, `Article`, `Activity` (events) plus a
  batched `City` lookup on every single request — no
  caching/revalidation, no pagination/sitemap-splitting.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: add `revalidate` (ISR) or move to
  `generateSitemaps` for pagination before real content volume/crawl
  traffic exists.
- Source: Task 16 audit (Final Release Safety Audit)

## [BACKLOG-090] Missing request-level memoization on `getCurrentUser()` / entity loaders — duplicate DB queries per request

- Status: OPEN
- Priority: P2
- Area: Performance
- Added: 2026-08-13
- Reason deferred: each individual query is a trivial indexed lookup
  (`Session.tokenHash`, `Place.id`/`Activity.id` unique/indexed), so this
  doesn't spike cost or risk the shared host at low initial traffic — but
  it's a real, well-understood Next.js anti-pattern hitting the two
  highest-traffic public page types plus every business dashboard page,
  and the fix is cheap and high-leverage.
- Context: `getCurrentUser()` (`src/lib/auth/server.ts:11` →
  `validateSession()` `src/lib/auth/session.ts:139`) is not wrapped in
  React's `cache()`, so it's not deduped within one request.
  `src/app/(public)/places/[slug]/page.tsx` runs the full `Place`
  `findUnique` twice per request (`generateMetadata` + page body);
  `src/app/(public)/[city]/events/[slugOrId]/page.tsx` runs
  `loadPublicActivityForCityPage` twice the same way, plus
  `getCurrentUser()` is called independently by the page body and by
  `AnalyticsDetailBeacon.tsx:26`. Same layout+page double-`getCurrentUser()`
  pattern repeats across `src/app/business/(protected)/*`.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: wrap `getCurrentUser()` and the per-entity page
  loaders (place/event detail) in React's `cache()` so repeated calls
  within one request are deduped.
- Source: Task 16 audit (Final Release Safety Audit)

## [BACKLOG-091] Leftover debug endpoints: `/api/debug/media-usage`, `/api/admin/debug-db`

- Status: OPEN
- Priority: P3
- Area: Cleanup
- Added: 2026-08-13
- Reason deferred: both correctly require `role === "ADMIN"` server-side
  (`debug-db` also 404s outside `NODE_ENV !== "production"`), so neither
  is exploitable by an unauthenticated or non-admin actor — cleanup, not
  a vulnerability.
- Context: `src/app/api/debug/media-usage/route.ts` (comment: "DEBUG
  ENDPOINT - Remove after debugging"), `src/app/api/admin/debug-db/route.ts`.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: remove both once no longer needed for debugging, or
  document why they should stay.
- Source: Task 16 audit (Final Release Safety Audit)

## [BACKLOG-092] `/ui-lab-admin` reachable on public surface with no auth guard

- Status: OPEN
- Priority: P3
- Area: Cleanup / Security hygiene
- Added: 2026-08-13
- Reason deferred: no real business/user data is rendered (static
  component/pattern demos only), and the site-wide noindex header already
  in place for the first-PROD preview covers it. Cosmetic
  info-exposure-of-internal-UI-patterns concern only.
- Context: `src/app/(ui)/ui-lab-admin/page.tsx` has no auth check and no
  `layout.tsx` guard; it lives outside the `/admin` path prefix so the
  admin-surface routing doesn't gate it either.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: gate behind an admin/dev check, or remove from the
  build for production, before broader public traffic.
- Source: Task 16 audit (Final Release Safety Audit)

## [BACKLOG-093] Debug `console.log` leftovers logging child PII in `children/[id]/route.ts`

- Status: OPEN
- Priority: P3
- Area: Privacy hygiene
- Added: 2026-08-13
- Reason deferred: ownership/auth checks in this same file are correct
  (`parentId: user.id` filter present on every operation) — this is a
  logging-hygiene issue, not an access-control bug, and not
  attacker-reachable.
- Context: `src/app/api/children/[id]/route.ts` — e.g. line 342
  `console.log("Child details:", { id, name })`, line 92
  `console.log("Request body:", body)` (includes child name/birthDate/
  interests), throughout PUT/GET/DELETE handlers.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: remove or redact these debug logs so child
  name/birthdate don't land in server stdout.
- Source: Task 16 audit (Final Release Safety Audit)

## [BACKLOG-094] `PlanItem` has no `@@unique` on its dedup keys — narrow TOCTOU duplicate-row race

- Status: OPEN
- Priority: P3
- Area: Data integrity
- Added: 2026-08-13
- Reason deferred: dedup is enforced only in application code (`findFirst`
  then `create`, e.g. `src/server/services/plan.service.ts:110-137`); a
  rapid double-submit has a narrow race window that could produce a
  duplicate `PlanItem` row. No data loss, no money involved, cosmetic at
  worst.
- Context: `PlanItem` has indexes on `[userId, activityId]` /
  `[userId, planRouteSlug]` / `[userId, planPlaceSlug]` but no `@@unique`.
- Current state: not started.
- Dependencies: needs a hand-written migration per this repo's Prisma
  rules (`prisma migrate dev`/`db push` forbidden — see `CLAUDE.md`).
- Acceptance criteria: add the appropriate `@@unique` constraint(s) via a
  hand-written migration, with dedup of any existing duplicate rows first.
- Source: Task 16 audit (Final Release Safety Audit)

## [BACKLOG-095] `scripts/dev/seed-demo-data.ts` not code-guarded against accidental PROD invocation

- Status: OPEN
- Priority: P3
- Area: Data integrity / Safety net
- Added: 2026-08-13
- Reason deferred: not wired into any auto-run path (`db:seed:demo` is a
  manual `pnpm` script, not in `docker-entrypoint.sh`), so it can only run
  against PROD via deliberate operator misuse — same class of risk as any
  admin script. Low priority, informational.
- Context: marked "DEV/STAGING ONLY" in a comment but not code-enforced,
  unlike its sibling `scripts/modules/import/dev/clear-import-data.ts`
  (`clearImportDataDevOnly()`), which throws if `NODE_ENV !==
  "development"`.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: add the same `NODE_ENV !== "development"` guard
  used by `clearImportDataDevOnly()`.
- Source: Task 16 audit (Final Release Safety Audit)

## [BACKLOG-096] Admin list views (`admin/content/places`, `admin/content/events`) lack pagination

- Status: OPEN
- Priority: P3
- Area: Performance
- Added: 2026-08-13
- Reason deferred: admin-only, internal traffic, and current row counts
  (83 places, 10 activities in DEV) make this a non-issue today.
- Context: `src/app/admin/content/places/page.tsx:81`
  (`prisma.place.findMany` with `include` of city/business/revisions, no
  `take`), `src/app/admin/content/events/page.tsx:81` similarly for
  `Activity`.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: add `take`/pagination before content volume grows
  into the hundreds/thousands.
- Source: Task 16 audit (Final Release Safety Audit)

## [BACKLOG-097] `UserEvent` `CARD_VIEW` writes not debounced/batched for logged-in users

- Status: OPEN
- Priority: P3
- Area: Performance / Analytics cost
- Added: 2026-08-13
- Reason deferred: each query is trivial (indexed lookup + upsert), not
  dangerous at current/expected first-PROD traffic — worth a fix only if
  traffic grows.
- Context: every `CARD_VIEW` analytics event (fired once per card via
  `IntersectionObserver` in `AnalyticsCardViewTracker.tsx`) triggers
  `applyUserBehaviorEvent`
  (`UserBehaviorAggregationService.ts:128`), which does a `findUnique` +
  upsert against `UserBehaviorProfile` per event — i.e. 1 insert + 1 read
  + 1 upsert per interaction, not debounced/batched. Scrolling a 20–40
  card feed as a logged-in user can generate that many individual
  `/api/analytics/events` POSTs.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: debounce/batch `CARD_VIEW` writes client-side if
  traffic growth makes this worth the complexity.
- Source: Task 16 audit (Final Release Safety Audit)

## [BACKLOG-098] No custom `not-found.tsx`/`error.tsx` anywhere in `src/app`

- Status: OPEN
- Priority: P3
- Area: SEO / UX polish
- Added: 2026-08-13
- Reason deferred: safe as-is — Next.js's default fallback pages don't
  leak stack traces or internal details in production — just unbranded.
  45 call sites already use `notFound()` across the app, so this is a
  pure presentation gap, not a functional or safety one.
- Context: no `not-found.tsx`, `error.tsx`, or `global-error.tsx` exists
  anywhere under `src/app`; every 404/500 falls back to Next's generic
  default page.
- Current state: not started.
- Dependencies: none.
- Acceptance criteria: add a branded `not-found.tsx` (and optionally
  `error.tsx`) at the root of `src/app`, consistent with the site's
  design system.
- Source: Task 16 audit (Final Release Safety Audit)

## [BACKLOG-099] User/business Phoenix CLIs cannot target PROD

- Status: DONE (2026-08-14)
- Priority: P1 — blocks FULL PROD content migration because Places/Events/
  Offers/ownership require migrated User ids in `--context-config`.
- Area: Migration / Users
- Added: 2026-08-14
- Reason deferred: found during Phoenix FULL PROD preflight; no code fix
  until owner-approved targeted change. Existing localhost gate is
  intentional safety from the LOCAL golden slices.
- Context: `assertLocalDatabaseUrl()` in
  `scripts/migration-user-vertical-slice.ts` (imported by user batch,
  business-ownership, role-elevation, authorship, activation-manifest)
  refuses anything except `localhost:5433/mamago2`. PROD DB is
  `prodmamago` inside `prod-db-1`. `migration:phoenix-release` adapters
  for users/businesses exist in lib but the CLI never registers them
  (`RELEASE_ADAPTER_REGISTRY_EMPTY`).
- Current state: live path `pnpm migration:user:live` exists. Frozen
  golden CLIs stay localhost-only. PROD still has 2 users until the
  owner-controlled import runs.
- Dependencies: owner decision on a PROD-safe user CLI gate (explicit
  `--confirm-production` + `PHOENIX_DATABASE_ENV=PROD` fingerprint,
  never silently widening the localhost gate).
- Acceptance criteria: a documented, guarded path can CREATE
  `PENDING_ACTIVATION` users on PROD with lineage/idempotency, without
  passwords, without activation emails, and without opening the local
  golden CLIs to arbitrary remotes.
- Source: Phoenix FULL PROD preflight (2026-08-14)
- Resolution: `assertMigrationDatabaseTarget` fail-closed gate. LOCAL golden
  remains `localhost:5433/mamago2`. PROD is identified by database name
  `prodmamago`. Writes require `--confirm-production`, `--confirm-writes`,
  and `--acknowledge-prod-user-import`. Activation email must stay disabled.
  Live path: `pnpm migration:user:live --preview` (default) or commit with
  the three flags. Frozen 564-user golden CLIs stay localhost-only.

## [BACKLOG-100] PRODUCTION migration profile requires indexing; prod.mamago.by must stay noindex

- Status: DONE (2026-08-14)
- Priority: P1 — operational footgun. `--profile PRODUCTION` and Phoenix
  `loadPhoenixEnvironment(PROD)` both fail closed unless
  `SITE_INDEXING_ENABLED=true`. Owner requirement is that
  `prod.mamago.by` remains noindex until the real `mamago.by` cutover.
- Area: Migration / SEO
- Added: 2026-08-14
- Reason deferred: needs an explicit pre-cutover profile (FULL media,
  validate redirects, do **not** require indexing) rather than weakening
  the eventual cutover gate.
- Context: `ProductionMigrationGuard` /
  `SEO_POLICIES.PRODUCTION.requireIndexingEnabled`;
  `src/lib/migration/release/environment.ts`
  `PRODUCTION_INDEXING_GATE_MISMATCH`. Current committed `manifest.csv`
  has 893 redirect rows vs default `REDIRECT_MANIFEST_MIN_ROWS=900`, so
  PRODUCTION profile would also fail the redirect-count guard.
- Current state: use `--profile FULL_IMPORT --media-policy FULL` or
  `--profile PROD_IMPORT`. Do not enable indexing on prod.mamago.by.
- Dependencies: none.
- Acceptance criteria: a named pre-cutover profile or flag that allows
  FULL media + redirect validation on a noindex PROD, without enabling
  indexing and without silently sampling media.
- Source: Phoenix FULL PROD preflight (2026-08-14)
- Resolution: named profile `PROD_IMPORT` (FULL media, SEO VALIDATE, redirects
  VALIDATE, no indexing requirement, still requires `--confirm-production`).
  Canonical pre-cutover command remains `--profile FULL_IMPORT --media-policy
  FULL` or `--profile PROD_IMPORT`. `loadPhoenixEnvironment(PROD)` no longer
  requires `SITE_INDEXING_ENABLED`. PRODUCTION profile still requires indexing
  for the eventual mamago.by cutover. Do not set `SITE_INDEXING_ENABLED=true`
  on prod.mamago.by.

## [BACKLOG-101] Phoenix release APPLY/RERUN is a stub; frozen 2026-07-30 manifest is stale

- Status: DONE (2026-08-14) — option (b): coordinator is not the FULL PROD path
- Priority: P2
- Area: Migration
- Added: 2026-08-14
- Reason deferred: `scripts/migration-phoenix-release.ts` still throws
  `RELEASE_ADAPTER_REGISTRY_EMPTY` after the BLOCKED-phase check.
  Content writes actually go through `migration:commit:wordpress-db`.
  The committed manifest
  `docs/migration/releases/phoenix-approved-2026-07-30.json` marks
  offers/routes/events/articles BLOCKED and encodes July-30 counts that
  no longer match live WordPress.
- Current state: `--plan` works (fingerprint + phase listing). `--apply`
  / `--rerun` cannot write. Live WP 2026-08-14 drifted vs the freeze
  (users 579→580, articles 115→117, published events 28→9, attachments
  9635→9703).
- Dependencies: BACKLOG-002/012 if the coordinator path is chosen;
  otherwise a new frozen executable scope for the commit-CLI path.
- Acceptance criteria: either (a) coordinator is wired and the manifest
  is regenerated from live approved scope, or (b) coordinator is
  explicitly retired in docs and the commit-CLI + fresh per-entity
  freeze is the only approved PROD path.
- Source: Phoenix FULL PROD preflight (2026-08-14)
- Resolution: option (b). FULL PROD uses `pnpm migration:commit:wordpress-db`
  plus `pnpm migration:user:live` and `pnpm migration:scope:wordpress-db`.
  Do not use `migration:phoenix-release --apply`. July freeze manifests are
  not current source truth. The APPLY stub remains in the repo unused.

## [BACKLOG-102] Voxel reviews have no Phoenix commit runner

- Status: DONE (2026-08-14)
- Priority: P1 — owner FULL PROD scope lists Reviews; code/docs still
  say NOT STARTED.
- Area: Migration / Reviews
- Added: 2026-08-14
- Reason deferred: no Review commit runner exists. Live source
  `wp_voxel_timeline` feed `post_reviews` = **25** rows (read-only,
  2026-08-14). Score scale is Voxel decimal −2..+2, not mamaGo 1–5.
- Context: `docs/migration/prelaunch-checklist.md` §5.6 still allows
  explicit founder P1 defer. Until that defer is re-confirmed for FULL
  PROD, this is a blocker.
- Current state: PROD `PlaceReview` count = 0. WP `wp_comments` is not
  the review source (only 1 spam row).
- Dependencies: owner decision — implement mapping or explicitly defer
  Reviews out of FULL PROD.
- Acceptance criteria: either a lineage-backed PlaceReview importer with
  a frozen rating formula, or a written owner exclusion.
- Source: Phoenix FULL PROD preflight (2026-08-14)
- Resolution: `ReviewCommitRunner` imports Voxel `post_reviews` into
  `PlaceReview` with `source=MAMAGO`, `sourceReviewId=wp-voxel-timeline:{id}`.
  Rating = clamp(round(score + 3), 1, 5). Missing user/place →
  SKIP_WITH_REASON. No guessed ownership. No notification side effects.
  Rerun is lineage-idempotent.

## [BACKLOG-103] FULL PROD media completeness gaps vs owner CONTENT+MEDIA rule

- Status: DONE (2026-08-14) — remaining profile/business media is BACKLOG-108
- Priority: P1 — owner requirement for this preflight: FULL PROD =
  content + all required images; no silent DEV-sample suppression.
- Area: Migration / Media
- Added: 2026-08-14
- Reason deferred: several media paths are still DEV-era policy, not
  missing-by-accident. Do not treat sampled METADATA as PROD policy.
- Context / remaining gaps (do not duplicate work already filed):
  - Offer cover/gallery: no FULL delegate; CLI hard-rejects
    `--entity offer --media-policy FULL` — BACKLOG-015.
  - Route extra stop images: implemented as `RouteStopImage` —
    BACKLOG-112 DONE. Cover mapping exists. Narrow replay remains
    BACKLOG-017 (P2 recovery tool).
  - Article cover/inline: normal `ArticleCommitRunner` writes
    `coverImageId: null`; import only via `--force-article-media-replay`.
  - Place logos: permanently excluded (`PLACE_LOGO_EXCLUDED`, 47
    published Places have `logo` meta).
  - User/business profile media: prelaunch checklist NOT STARTED.
  - LOCAL/DEV sampling allowlist of 9 keys still applies whenever
    `--media-policy` is omitted.
- Current state: Offer FULL delegate, Place logos, Article FULL first-run,
  Route cover + RouteStopImage gallery, Event FULL (unchanged) are
  implemented. Remaining P2: BACKLOG-017 narrow Route replay;
  BACKLOG-108 Business/User profile images (no target field). Always pass
  `--media-policy FULL` on PROD so LOCAL/DEV sampling cannot suppress
  images.
- Dependencies: owner exceptions per entity, or targeted importers.
- Acceptance criteria: every in-scope entity either imports required
  images under `--media-policy FULL` or has an explicit owner-approved
  exclusion recorded here.
- Source: Phoenix FULL PROD preflight (2026-08-14)

## [BACKLOG-104] Phoenix cannot run on the shared DEV+PROD host — WP is unreachable from it

- Status: DONE (2026-08-14) — topology documented; runner stays on operator Mac
- Priority: P1 — chooses execution topology. Running a one-shot
  migration container on `134.17.17.134` cannot read WordPress or fetch
  media.
- Area: Migration / Ops
- Added: 2026-08-14
- Reason deferred: confirmed live this session; needs a written PROD
  runbook using the proven operator-Mac path, not a host-side container.
- Context: from `mamago-prod`, TCP to `134.17.16.78:22`, `mamago.by:443`
  and `:80` all timed out. Operator Mac can SSH to WP (inspect succeeded)
  and HTTP-fetch `mamago.by`. Same finding as BACKLOG-018's DEV note,
  now confirmed for PROD as well.
- Current state: recommended path = operator Mac + SSH tunnel to
  `prod-db-1` + WP SSH from the Mac + HTTP media fetch + stage into
  `MEDIA_STORAGE_ROOT` then copy **only** into `prod_mamago2_storage`.
- Dependencies: none for the topology itself; BACKLOG-099 for users.
- Acceptance criteria: PROD Phoenix runbook documents this topology and
  forbids running the importer on the shared host until WP/HTTP
  reachability is proven from that host.
- Source: Phoenix FULL PROD preflight (2026-08-14)

## [BACKLOG-105] Migration commits bypass SearchIndexer

- Status: OPEN
- Priority: P2
- Area: Migration / Search
- Added: 2026-08-14
- Reason deferred: not unsafe; public search/discovery will be empty or
  stale until a separate reindex after import. Commit CLIs correctly use
  bare `PrismaClient` (no notification/search side effects).
- Context: `@/lib/prisma` wraps `SearchIndexerService`;
  `scripts/migration-commit-wordpress-db.ts` documents that it must not
  use that singleton.
- Current state: no post-import reindex step in the current runbook.
  PROD after initial import (2026-08-14): `SearchDocument` = 0. Content is
  PENDING/DRAFT so public search should stay empty until publication.
  Reindex is mandatory after publish, not before.
- Dependencies: a successful PROD content import.
- Acceptance criteria: documented, idempotent reindex (or indexer
  backfill) runs after Phoenix commit and is part of reconciliation.
- Source: Phoenix FULL PROD preflight (2026-08-14)

## [BACKLOG-106] No deleted-legacy sync; Event/Article/Route UPDATE lacks Place-style safety

- Status: OPEN
- Priority: P2
- Area: Migration / Idempotency
- Added: 2026-08-14
- Reason deferred: first PROD import is onto an empty content DB, so
  overwrite/delete-sync is not a first-write P0. It becomes a cutover
  risk on the freeze→final-rerun window and on any later rerun after
  editorial edits.
- Context: lineage is hash-based CREATE/UPDATE/SKIP_UNCHANGED. Missing
  WP rows are not deleted in target. Only Places have
  `classifyPlaceUpdateSafety` / `TARGET_MODIFIED_AFTER_IMPORT`. Event
  sessions and RouteStops `deleteMany`+recreate on UPDATE. Users block
  on source-hash change instead of updating.
- Current state: Event/Article/Route/Review UPDATE now uses
  `classifyImportedTargetUpdateSafety` (timestamp gate, QUARANTINE on
  conflict). Route UPDATE no longer overwrites `status`/`visibility`/
  `authorId`. Delete-sync of WP-deleted rows is still absent and remains
  a freeze→final-rerun cutover issue. Source drift 2026-08-14T10:44:34Z →
  11:15Z: 0 added/removed/hash-changed rows; 0 new users/attachments;
  0 trash. Policy (not implemented): at freeze, emit the lineage keys
  present in PROD and absent from live WP scope; owner approves
  archive/keep per row; no automatic delete or tombstone.
- Dependencies: owner policy for the freeze window (new/changed/deleted
  WP rows).
- Acceptance criteria: documented final-sync behavior for new / changed /
  deleted legacy rows; safety classifier or media-only replay for
  Event/Article/Route before any hash-driven UPDATE against a
  possibly-edited PROD.
- Source: Phoenix FULL PROD preflight (2026-08-14)

## [BACKLOG-107] Stale Phoenix production runbooks vs current commit CLI

- Status: DONE (2026-08-14)
- Priority: P3
- Area: Docs / Migration
- Added: 2026-08-14
- Reason deferred: docs drift, not a runtime defect. `docs/migration/
  production-cutover-runbook.md` still says users/offers/routes/reviews
  have no runners; `migration-engine.md` still says Event images are
  excluded. Both are false in current `dev`.
- Current state: authoritative live path is
  `pnpm migration:commit:wordpress-db` + user/business CLIs;
  `docs/migration/production-migration-runbook-2026-07-29.md` is closer
  but still assumes founder hosting inputs that now exist
  (`prod.mamago.by` / `prod-db-1` / `prod_mamago2_storage`).
- Dependencies: none.
- Acceptance criteria: one current PROD Phoenix runbook; stale “Event
  images excluded” / “no user runner” statements removed or clearly
  marked historical.
- Source: Phoenix FULL PROD preflight (2026-08-14)
- Resolution: current-state banners added to cutover/runbook docs. LIVE
  path is commit-CLI + `migration:user:live` + `migration:scope:wordpress-db`.
  Event images ARE imported under `--media-policy FULL`. Reviews and live
  users have runners. Historical Phase 1/2D text is marked historical.

## [BACKLOG-108] Business/User profile images have no mamaGo 2.0 target field

- Status: RESOLVED (2026-08-15) — User avatars: PROD replay complete, 48
  imported, 18 broken refs explained, `wordpress-db:user:1` explained by
  the existing `PRIVILEGED_ACCOUNT_COLLISION` policy (its WordPress email
  collides with the existing mamaGo ADMIN, so `migration:user:live` never
  created a User for it — correction 2026-08-15: this is a distinct,
  runtime email-collision check in `UserMigrationVerticalSlice.planUserMigration`/
  `liveWordPressUserSource.ts`, **not** the static
  `phoenix-users-founder-exclusions-2026-07-31.json` list, which covers a
  different, unrelated set of 5 user IDs (7/17/22/42/43) and does not
  contain ID 1). Never migrated as a User, so never eligible for an
  avatar write — see `UserAvatarSyncer`'s USER_NOT_MIGRATED_YET path.
  Business logos: owner-excluded, out of scope for current cutover,
  non-blocking.
  **Provenance note:** the PROD backfill run itself (preview + write) was
  executed and reported by the project owner directly — this session's own
  SSH path to PROD was interrupted mid-preflight before it could
  independently run or re-verify the backfill, so these counts are
  recorded as owner-reported, not independently confirmed by this session.
- Priority: P2
- Area: Migration / Media / Schema
- Added: 2026-08-14
- Reason deferred (original): FULL PROD media audit found no `Business`
  image column and no proven WordPress field feeding `User.avatarUrl` in
  the live importer. Inventing storage would violate schema.
- Context: `Business` still has name/phone/UNP/status only — no schema
  change is planned; owner decision (2026-08-15) is that Business logos are
  explicit post-release scope, not required before cutover.
  `User.avatarUrl` already exists on schema and is actively rendered
  (header/account menu, mobile nav, article byline, place review author,
  direct messages). Live WP user SELECT previously omitted any avatar
  column; Voxel profile media was unmapped.
- Current state (2026-08-15): User-avatar import support implemented —
  `wp_usermeta.meta_key = 'voxel:avatar'` is now read
  (`WordPressRepository.getUserMetaByKey`), classified
  (`voxelAvatarSource.ts`: valid attachment / broken ref / non-attachment
  value — Telegram `wptg_login_avatar`/Gravatar/default avatars are never
  read, by construction), and imported via a narrow, idempotent
  avatar-only backfill (`UserAvatarSyncer.ts` +
  `scripts/migration-user-avatar-backfill.ts`,
  `pnpm migration:user:avatar-backfill`). This is a **replay against
  already-migrated Users only**: it never creates or recreates a User,
  never touches any other User column, and only ever writes
  `avatarUrl` when it is currently `null` (never overwrites a
  user-provided avatar). Media import/dedup reuses the same
  `MigrationLineage`-backed attachment lineage as Place/Event/Article/
  Route media, so a re-run is a no-op and no duplicate `MediaAsset`/file
  is ever created. Verified inventory (2026-08-14, live WP):
  575 Phoenix-eligible users, 49 importable Voxel avatar attachments, 18
  broken references (attachment id present in usermeta, `wp_posts` row
  missing — reported as an explained skip, not a failure).
  **PROD replay executed 2026-08-15** (owner-run/reported, see provenance
  note above): 48 of the 49 valid attachments imported (the 49th belongs
  to `wordpress-db:user:1`, blocked from Phoenix User migration entirely
  by `PRIVILEGED_ACCOUNT_COLLISION` — see correction note above, this is
  not the founder-exclusion list — so it was never an eligible target —
  `USER_NOT_MIGRATED_YET`, not a failure), 18 broken refs skipped
  as explained (`AVATAR_ATTACHMENT_MISSING`), zero unrelated User fields
  changed, zero duplicate MediaAsset/files.
- Dependencies: none remaining — Business logos owner-excluded, User
  avatars PROD replay complete.
- Acceptance criteria: User avatars — met (PROD replay executed, 48/49
  imported with the 1 exclusion explained, 18 broken refs reported as
  skips, zero unrelated User fields changed). Business logos — closed as
  owner-excluded, no further action required for current cutover.
- Source: Phoenix FULL PROD readiness (2026-08-14); User avatar migration
  support (2026-08-15); PROD replay (2026-08-15).

## [BACKLOG-109] Phoenix commit does not write MediaUsage rows

- Status: OPEN
- Priority: P2
- Area: Migration / Media / Admin
- Added: 2026-08-14
- Reason deferred: public rendering of migrated Places/Events/Articles/
  Offers/Routes does not query `MediaUsage`; it uses `PlaceImage`,
  `Activity.coverImageId`/`ActivityImage`, `Article.coverImageId` +
  `contentJson` image blocks, `Offer.coverImage`/`galleryImages`, and
  `RouteStop.photoUrl`. PROD after initial import: MediaAsset 1551,
  MediaUsage 0.
- Context: `MediaUsage` feeds the admin media library “used in” map and
  metadata autogen. Phoenix commit uses a bare `PrismaClient` and never
  calls `syncPlaceMediaUsage` / equivalent.
- Current state: acceptable for public pages; admin library usage counts
  are empty for migrated files.
- Dependencies: none for public cutover. Needed if admin usage tracking
  must be correct on day one.
- Acceptance criteria: documented backfill (or importer write) of
  MediaUsage for migrated entity image fields, or explicit owner
  exclusion that admin usage tracking can wait.
- Source: Phoenix initial PROD QA (2026-08-14)

## [BACKLOG-110] PROD storage contains macOS AppleDouble `._*` sidecars from tar copy

- Status: OPEN
- Priority: P3
- Area: Migration / Storage
- Added: 2026-08-14
- Reason deferred: not content duplicates and not referenced by
  MediaAsset. Do not delete during QA. `find /app/storage` = 9534 files
  vs staging 4766 because the Mac `tar` of `media-staging/uploads`
  included AppleDouble forks (`._*.webp`, 4767 files, ~14KB total) plus
  4766 real webp (466832226 bytes) plus `._uploads` / `.gitkeep`.
- Context: copy used `tar -C media-staging -cf - uploads | docker exec
  tar -xf - -C /app/storage`. Unique real files = 4766; duplicate
  basenames among real webp = 0.
- Current state: unexpected files are AppleDouble only. No nested
  duplicate hierarchy of image bytes.
- Dependencies: none.
- Acceptance criteria: future copies use COPYFILE_DISABLE=1 / `--noleaf`
  / `tar --disable-copyfile`; optional later cleanup of `._*` after
  owner approval. Do not delete in the current QA window.
- Source: Phoenix initial PROD QA (2026-08-14)

## [BACKLOG-111] Commit CLI DEFAULT_LIMIT=100 silently truncates entity batches

- Status: OPEN
- Priority: P2
- Area: Migration / CLI
- Added: 2026-08-14
- Reason deferred: recovered in the same session with `--limit 20000`;
  not a data-loss bug once the flag is passed. It did truncate the first
  Articles pass (40 of 117) until rerun.
- Context: `src/lib/migration/adapters/wordpress-db/sql.ts`
  `DEFAULT_LIMIT = 100`, `MAX_LIMIT = 20000`. FULL PROD must always pass
  `--limit 20000`.
- Current state: operational footgun. Canonical command in the execution
  prompt already includes `--limit 20000`.
- Dependencies: none.
- Acceptance criteria: fail-closed when FULL/PROD profile is used
  without an explicit limit, or default FULL limit = MAX_LIMIT.
- Source: Phoenix initial PROD QA (2026-08-14)

## [BACKLOG-112] RouteStop can store only one photo; 510 WP stop images cannot be imported

- Status: DONE (2026-08-14) — `RouteStopImage` join table + Phoenix importer
  + public `photos[]` mapping. Not applied to PROD yet.
- Priority: P1 — owner requirement is that the final PROD migration keep
  all meaningful Route images.
- Area: Migration / Media / Routes / Schema
- Added: 2026-08-14
- Reason deferred: closed by implementation. Owner-controlled Prisma
  `migrate deploy` + Route-only PROD rerun are the remaining ops steps,
  not this item.
- Context: live WP (2026-08-14) for 14 published routes:
  unique source media IDs 612; covers 14/14 (`_thumbnail_id`); stop image
  occurrences 604; first images 94; extra images 510; 3 stops have no
  images; 13 attachment IDs have no `wp_posts` row (1 first-stop `41226`,
  12 extras, 0 covers).
- Current state: first usable stop attachment → `RouteStop.photoUrl`;
  every usable stop attachment including the first → `RouteStopImage`
  (`sortOrder`, `mediaAssetId`, cascade delete, unique per stop+order and
  stop+asset). Public detail/list map `RouteStopImage` to `stop.photos[]`
  with `photoUrl` fallback. Editor still persists only the first photo.
- Acceptance criteria: every extra in-scope stop image is stored,
  linked, rerun-safe (MediaAsset lineage), and visible in public/admin
  without dropping the first `photoUrl`.
- Source: Phoenix Route media gap closure (2026-08-14)

## [BACKLOG-113] Placeless-import Offer media never syncs after a Place is assigned later

- Status: **RESOLVED-MOOT (2026-08-14)** — the batch this item was tracking
  (28 legacy Offers) is now permanently excluded from Phoenix migration by
  owner decision (`OWNER_EXCLUDED_LEGACY_OFFER`,
  `src/lib/migration/validators/policies.ts`,
  `OWNER_EXCLUDED_LEGACY_OFFER_IDS`) — they will never be imported again, so
  the specific gap described below (their media never syncing after a later
  Place assignment) cannot occur anymore. No longer a cutover blocker.
- Priority: was P3 (cosmetic gap for a small, known batch); now moot for
  that batch.
- Area: Migration / Media / Offers
- Added: 2026-08-14
- Reason deferred (original): out of scope for "allow DRAFT Offer without
  Place" — fixing it means either widening the shared
  `mediaImporterFactory` (`(ownerUserId: string) => MediaImporterLike`,
  used by Place/Article/Event/Route too) to accept a null owner, or adding
  a new "resync media on Place assignment" trigger. Both are real scope
  beyond making `placeId` nullable.
- Context: `OfferCommitRunner.execute` only calls `OfferMediaSyncer.sync`
  on Offer CREATE (`!isUpdate`), never on a later PATCH. For a Phoenix
  Offer imported with no Place relation (`buildOfferCreateDraft`'s
  `allowUnassignedPlace` branch), `context.ownerUserId` is `null`, so media
  sync is skipped entirely at creation
  (`src/lib/migration/commit/offer/OfferCommitRunner.ts`) — there is no
  owner to attribute a `MediaAsset.uploadedById` to (Offer ownership is
  derived only from Place). `draft.sourceMediaAttachmentIds` and the
  canonical hash still carry the original WordPress attachment IDs, so no
  evidence is lost, but nothing re-imports them once an admin assigns a
  Place via `AssignOfferPlaceControl`
  (`src/components/admin/offers/AssignOfferPlaceControl.tsx`).
- Current state: unassigned-import Offers get `coverImage`/`galleryImages`
  populated only if manually re-run through a Phoenix path that resolves a
  Place, or someone builds a dedicated backfill.
- Acceptance criteria (original, no longer needed for the 28): after a
  Place is assigned to a previously placeless imported Offer, its original
  WordPress cover/gallery images end up on
  `Offer.coverImage`/`galleryImages`, without fabricating an owner and
  without changing the shared media importer's signature for every other
  entity.
- Residual generic gap (P3, open, non-blocking): the underlying mechanism
  — `OfferCommitRunner` skipping media sync whenever `context.ownerUserId`
  is `null` — is generic, not specific to these 28 IDs. DRAFT-without-Place
  remains a supported product capability (owner decision, "Allow DRAFT
  Offer without Place" task) — if a *future* Phoenix source ever produces
  another genuinely placeless Offer (a new `MISSING`-collapse record, not
  in the exclusion list), the same media-sync gap would apply to it. No
  known current instance exists, so this is not a cutover blocker; revisit
  only if a new placeless batch appears.
- Source: "Allow DRAFT Offer without Place" (2026-08-14); closed by
  "Exclude 28 legacy Offers from Phoenix migration" (2026-08-14)

## [BACKLOG-114] `Offer.cityId` is never written by the business create/update API (pre-existing, unrelated)

- Status: OPEN
- Priority: P3 — `cityId` is a routing/indexing snapshot; public offer
  pages already resolve city via `offer.place?.city?.slug`, not
  `Offer.cityId`, so this has not been observed to break anything user
  facing. Found while auditing all `Offer.placeId`/`cityId` write paths for
  the "allow DRAFT Offer without Place" change — not caused by it, not
  fixed by it (out of scope, rule 11: pre-existing/foreign, recorded not
  silently patched).
- Area: Offers / Data integrity
- Added: 2026-08-14
- Reason deferred: unrelated to the current task's scope; needs its own
  audit of what actually reads `Offer.cityId` (the `@@unique([cityId,
  slug])` constraint and sitemap filters are the only confirmed
  consumers so far) before deciding the right fix.
- Context: neither `POST /api/business/offers` nor
  `PATCH /api/business/offers/[id]` ever sets `cityId` in their Prisma
  write payload — grepped both files, zero hits. The schema comment on
  `Offer.cityId` (`prisma/schema.prisma`) says it is "filled by a
  save-hook", but no such hook (Prisma `$extends`/`$use` middleware, DB
  trigger, or explicit write) was found anywhere in `src/` or
  `prisma/migrations/*/migration.sql`. Only the Phoenix commit writer
  (`OfferCommitWriter.ts`) actually sets it, from
  `draft.ownership.cityId`.
- Current state: business-wizard-created/edited Offers likely have
  `cityId: null` regardless of their Place's city.
- Acceptance criteria (for whoever picks this up): confirm whether
  `Offer.cityId` is load-bearing anywhere beyond the unique-slug
  constraint and sitemap query, then either wire a real save-hook or drop
  the "filled by a save-hook" schema comment if it's stale.
- Source: "Allow DRAFT Offer without Place" (2026-08-14)

## [BACKLOG-115] Place canonical URL is not city-scoped, but Place.slug uniqueness is

- Status: RESOLVED (2026-08-15) — owner decided (a): city-scope the Place
  URL.
- Priority: P2 (was)
- Area: SEO / Routing / Schema
- Added: 2026-08-15
- Context: `Place.slug` is `@@unique([cityId, slug])` (partial, per-city —
  `20260608114243_city_scoped_slugs`), but the canonical URL had no city
  segment and the lookup wasn't city-scoped — a real cross-city collision
  risk once a second city launches.
- Resolution: canonical flipped to `/{city}/places/{slug}`
  (`src/app/(public)/[city]/places/[slug]/page.tsx` — was previously a
  redirect stub, now the real detail page). `/places/{slug}`
  (`src/app/(public)/places/[slug]/page.tsx`) is now the redirect-only
  legacy alias: resolves the place globally (unavoidable — the city isn't
  known from that URL), then 301s to its real city-scoped canonical.
  `findPlaceBySlugInCity()` (`src/lib/slug/placeSlugService.ts`) is the
  new city-scoped lookup the canonical route uses (scoped by `cityId`,
  closing the collision gap); the global `findPlaceBySlug()` remains, used
  only by the legacy redirect resolver. `resolvePlaceCanonicalUrl.ts` now
  requires `citySlug`. Sitemap, search index, SEO admin provider,
  `syncPlaceCanonical()`, and the primary public-facing internal links
  (related-places, Offer↔Place cross-links, `PlaceCard`) were updated to
  build city-scoped paths; a residual set of lower-traffic internal links
  (admin dashboards, direct-message threads, `my-plan`) still point at the
  legacy path, which correctly redirects — tracked under BACKLOG-118.
  A Place with no resolvable city cannot get a canonical at all (confirmed
  0/81 published Places are cityless in local DB) — reported as
  `UNRESOLVED`/`NO_CITY` by `seo-slug-backfill.ts`, never guessed.
  Verified end-to-end in the browser: canonical route renders, legacy
  `/places/{slug}` 301s to it. See
  `docs/migration/seo/final-url-architecture-2026-08-15.md` §2 (updated).
- Tests: `resolvePlaceCanonicalUrl.test.ts` (city in canonical, same slug
  in two cities resolves independently, old global path never trusted as
  stored canonical).
- Source: SEO-stable URL architecture audit (2026-08-15); Place/Offer
  final contract implementation (2026-08-15).

## [BACKLOG-116] Offer `{section}` URL segment is computed from stale/dead fields, not a persisted taxonomy

- Status: RESOLVED (2026-08-15) — owner decided: drop `{section}` from
  the canonical URL entirely rather than make it deterministic.
- Priority: P3 (was)
- Area: SEO / Routing / Offer
- Added: 2026-08-15
- Context: `getOfferPublicSection()`
  (`src/lib/offers/offerPublicUrl.ts`) branches on `offer.kind` +
  `durationType` + `campProgramType` using string literals that don't all
  match the current `OfferKind` enum (`EVENT | SERVICE` only) — dead
  branches from a wider historical kind set — and `findOfferBySlug()`
  looked up by slug only, no city/section filter, so the URL's
  `{city}`/`{section}` segments were cosmetic for resolution, the same
  latent-collision shape as BACKLOG-115. Related: BACKLOG-114
  (`Offer.cityId` often unset for business-created Offers).
- Resolution: canonical is now `/{city}/offers/{slug}` — `{section}` is no
  longer part of Offer identity at all (owner: "Section/category остаётся
  data field/filter/navigation concept, НЕ является частью canonical
  URL"). `getOfferPublicPath()`/`getOfferPublicUrl()`
  (`src/lib/offers/offerPublicUrl.ts`) no longer accept
  `kind`/`durationType`/`campProgramType`; `getOfferPublicSection()` is
  unchanged and still used for taxonomy/filter/listing purposes, just
  never for the detail canonical. The collision gap is separately closed:
  `findOfferBySlugInCity()` (`src/lib/slug/offerSlugService.ts`) scopes by
  `Offer.cityId` — the field the DB's own `@@unique([cityId, slug])`
  constraint is built on — and is what the new canonical route
  (`src/app/(public)/[city]/offers/[slug]/page.tsx`) uses first, falling
  back to a global lookup only to find the offer's real city for a
  redirect (never rendering under a mismatched city). `Offer.cityId`
  reliability (BACKLOG-114) is unaffected by this fix and remains a
  separate, open issue — a scoped-lookup miss safely falls through to the
  global-lookup path rather than 404ing.
  `/{city}/offers/{section}/{slug}` (moved to
  `src/app/(public)/[city]/offers/[slug]/[legacySlug]/page.tsx` — Next.js
  requires sibling dynamic segments at one path depth to share a param
  name, hence the directory rename) and `/offers/{slug}` are both
  redirect-only legacy aliases now. Verified end-to-end in the browser:
  canonical route renders, both legacy paths 301 to it. See
  `docs/migration/seo/final-url-architecture-2026-08-15.md` §3 (updated).
- Tests: `resolveOfferCanonicalUrl.test.ts` (section-free canonical, old
  section-scoped stored value never trusted, same slug in two cities
  resolves independently) + new `offerPublicUrl.test.ts` (section changes
  never affect the canonical path).
- Source: SEO-stable URL architecture audit (2026-08-15); Place/Offer
  final contract implementation (2026-08-15).

## [BACKLOG-117] Three independent Cyrillic transliteration/slugify implementations

- Status: OPEN
- Priority: P3 — each is correctly used by its own entity today, no known
  bug; pure duplication risk (drift between mappings over time).
- Area: SEO / Code Quality
- Added: 2026-08-15
- Reason deferred: not blocking, and touching all call sites of any one
  implementation is a wider, riskier change than this task's scope.
- Context: `src/lib/slugify.ts` (`slugifyRu`, used by Activity/Offer/Route
  slug services), `src/lib/slug/slugUtils.ts` (a separate transliteration
  map, used only by Place's name/address-based slug builder), and
  `src/lib/slugifyLabelToValue.ts` (used for taxonomy/admin label→value,
  not entity slugs) each implement their own Cyrillic→Latin mapping with
  slightly different rules (e.g. `х→h` vs `х→kh`).
- Current state: documented in
  `docs/migration/seo/final-url-architecture-2026-08-15.md` §10.
- Dependencies: none.
- Acceptance criteria: consolidate to one shared transliteration table (or
  explicitly document why entity slugs and taxonomy labels need different
  rules, if they genuinely do).
- Source: SEO-stable URL architecture audit (2026-08-15)

## [BACKLOG-118] Internal hrefs for Place/Route/Event/blog are hand-built, not via the canonical-URL builders

- Status: OPEN — partially addressed 2026-08-15 alongside BACKLOG-115/116.
- Priority: P2 for the remaining Place call sites (now point at a
  redirect, not dead — but every extra hop is avoidable cost); P3 for
  Route/Event/blog, unchanged.
- Area: SEO / Code Quality
- Added: 2026-08-15
- Reason deferred: fixing every remaining call site is a wide, mechanical
  refactor out of proportion for a single task ("не усложнять систему
  сейчас").
- Context: `resolvePlaceCanonicalUrl.ts`/`resolveEventCanonicalUrl.ts`/
  `resolveRouteCanonicalUrl.ts`/`resolveArticleCanonicalUrl.ts` are each
  the correct source of truth for canonical metadata, but internal
  navigation links are built with manual template literals at each call
  site instead of a shared plain-path builder.
- Progress (2026-08-15, Place city-scoping work): `src/lib/placePublicUrl.ts`
  now accepts an optional `citySlug` (backward-compatible — falls back to
  the legacy path, which still 301s, when omitted);
  `PlaceCard.tsx` gained an optional `citySlug` prop; fixed the
  higher-traffic call sites — `buildPlaceDocument.ts` (search index),
  `place.ts`/`offer.ts` SEO admin providers, `syncPlaceCanonical()`,
  `sitemap.ts`, `OfferHero.tsx`/`OfferPlace.tsx` (offer→place cross-link,
  now threads `citySlug` through `OfferPageView`→`OfferPlace`). Still
  legacy-path (redirects, not broken): admin dashboards/moderation views,
  direct-message thread links, `my-plan` feature, Route stop JSON-LD,
  admin search-index debug tool, business "preview my place" page.
- Current state: documented in
  `docs/migration/seo/final-url-architecture-2026-08-15.md` §10.
- Dependencies: none.
- Acceptance criteria: one exported plain-path builder per entity (can
  reuse the `expectedPath` logic already inside each `resolve*CanonicalUrl`
  — just needs extracting/exporting), remaining scattered call sites
  migrated incrementally.
- Source: SEO-stable URL architecture audit (2026-08-15)

## [BACKLOG-119] Three independent implementations of "resolve the public base host"

- Status: OPEN
- Priority: P3 — currently consistent in practice (`mamago.by` prod
  default in all three), pure duplication risk.
- Area: SEO / Code Quality
- Added: 2026-08-15
- Reason deferred: not blocking; low risk while all three agree.
- Context: `src/lib/config/publicAppUrl.ts` (`getCanonicalPublicAppUrl`),
  `src/lib/seo/globalNoindex.ts` (`DEFAULT_PUBLIC_SITE_URL`), and
  `src/lib/seo/buildOgMeta.ts` each independently read
  `APP_PUBLIC_URL`/`NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_SITE_URL` with
  slightly different fallback chains/defaults.
- Current state: documented in
  `docs/migration/seo/final-url-architecture-2026-08-15.md` §10.
- Dependencies: none.
- Acceptance criteria: one shared function all three call into.
- Source: SEO-stable URL architecture audit (2026-08-15)

## [BACKLOG-120] No public 301 is served from *SlugHistory after a manual slug edit

- Status: OPEN
- Priority: P3 — feature gap, not a bug; `*SlugHistory` tables exist and
  are correctly written on every slug change, but nothing yet serves a
  redirect off them for every entity's public detail route (Place's
  `findPlaceBySlug` does check history and return `isRedirect: true`;
  unclear whether every entity's public page actually acts on that flag).
- Area: SEO / Routing
- Added: 2026-08-15
- Reason deferred: explicitly out of scope for this task ("Не строить
  сейчас redirect history feature, если её ещё нет — вынести отдельно в
  backlog при необходимости").
- Context: `PlaceSlugHistory`/`ActivitySlugHistory`/`OfferSlugHistory`/
  `ArticleSlugHistory`/`RouteSlugHistory` all exist and are written by
  `update*Slug()` (`src/lib/admin/seo/entities/applyEntitySeoUpdate.ts`).
- Current state: documented in
  `docs/migration/seo/final-url-architecture-2026-08-15.md` §10.
- Dependencies: none.
- Acceptance criteria: audit + confirm (or fix) that every entity's public
  detail page 301s from a retired slug to the current one, not just Place.
- Source: SEO-stable URL architecture audit (2026-08-15)

## [BACKLOG-121] DEV host has no NAT hairpin/loopback for its own public IP — health_endpoint detector permanently CRITICAL on DEV

- Status: DONE
- Priority: P2 — infra config (was blocking green DEV Operations Center baseline)
- Area: Infra / DEV host networking (`134.17.17.134`, `/opt/mamago/dev`)
- Added: 2026-08-16
- Resolved: 2026-08-16
- Context: Operations Center `health_endpoint` must probe
  `${APP_PUBLIC_URL}/api/health` (`https://dev.mamago.by` → `134.17.17.134`)
  from `dev-worker-1` via the real public path (DNS → TLS → Traefik → web).
  External clients were fine; container/host TCP to the floating public IP
  timed out (~5s) because `134.17.17.134` is upstream NAT and not on the
  host NIC (`192.168.185.209`), with no hairpin back to local Traefik.
- Root cause: missing DEV-container hairpin to the upstream floating IP.
- Fix: one DEV-source-subnet-scoped HTTPS DNAT only:
  `-s 172.19.0.0/16 -d 134.17.17.134 -p tcp --dport 443`
  → `192.168.185.209:443` (local Traefik publish). No OUTPUT rules, no
  port 80, no MASQUERADE, no PROD subnet (`172.20.0.0/16`) match.
- Persistence: `/etc/systemd/system/mamago-dev-hairpin.service`
  (oneshot, `iptables -C || -I`, enabled; ExecStop removes the same rule).
- Verification: worker → public health ~130ms HTTP 200 (`dev-313`);
  `health.endpoint_failed:prod` auto-RESOLVED (`resolution=AUTO`);
  Step 3 node matrix PROD/DB/Operations/Indexability = OK/OK/OK/NO_DATA.
- Source: Operations Center Step 3 DEV acceptance + BACKLOG-121 host fix
  (2026-08-16)

## [BACKLOG-122] Repo-wide ESLint has 14 pre-existing errors; not enforced in CI/check:push

- Status: OPEN
- Priority: P3 — code quality debt, not a release blocker; none of the 14
  findings are in Operations Center Step 5/6 code.
- Area: Tooling / Code quality
- Added: 2026-08-17
- Reason deferred: out of scope for Operations Center Step 6 (audit
  adapter + retention); fixing them would mix unrelated changes into that
  commit. Flagged per CLAUDE.md rule 11 (pre-existing/foreign errors must
  be recorded, not silently fixed or scope-crept into the current task).
- Context: while auditing Step 6's ESLint validation gate, discovered
  `npx eslint` was completely unrunnable repo-wide — crashed on every
  file (`TypeError: expand is not a function`) because the
  `"brace-expansion@<1.1.13": ">=1.1.13"` pnpm override (no upper bound)
  collapsed `minimatch@3.1.4`'s `brace-expansion` dependency (needs
  `^1.1.7`) onto the unrelated `brace-expansion@5.0.6` override group.
  Fixed in isolated commit `f5043ed5` (`fix(deps): scope brace-expansion
  override to its own major line`) by bounding the override to `<2.0.0`;
  lockfile diff is limited to that one dependency edge.
- Current state: with `f5043ed5` applied, `npx eslint src --quiet`
  now runs to completion and reports exactly 14 pre-existing errors,
  none introduced by Step 6:
  - `src/components/**` (3 files): `react-hooks/set-state-in-effect`
  - `src/lib/migration/commit/context/resolveEventCommitContextWithMatching.ts`
    + its `.test.ts`: `@typescript-eslint/no-explicit-any` (7 occurrences)
  - `src/server/ops/detectors/moderationQueueStale.test.ts` (Step 4):
    `prefer-const` (1 occurrence)
  Neither `pnpm check:push` (`tsc --noEmit && pnpm build`) nor the GitHub
  Actions "CI" workflow (`.github/workflows/ci.yml`, `typecheck` job
  only) run ESLint at all — only `pnpm check`/`pnpm lint` do, and those
  are not part of any automated gate today.
- Dependencies: none.
- Acceptance criteria: fix all 14 pre-existing findings (or their
  root causes) so `pnpm lint` is repo-wide green; then add an ESLint
  step to CI and/or `check:push` so future regressions are caught
  automatically instead of silently accumulating.
- Source: Operations Center Step 6 (audit adapter + retention) ESLint
  validation-gate audit (2026-08-17)

---

## [BACKLOG-123] Telegram/Resend follow-ups after production-readiness audit

- Status: OPEN
- Priority: P2
- Area: Telegram / Email
- Added: 2026-08-19
- Reason deferred: out of scope for the current audit/hardening pass. Code now
  selects Telegram credentials via `APP_ENV` (not `NODE_ENV`). Remaining items
  need owner action or a later PROD image deploy.
- Context:
  - PROD still has a leftover unsuffixed `TELEGRAM_BOT_TOKEN` / `@mamaGo_bot`
    beside `TELEGRAM_BOT_TOKEN_PROD` / `@mamaGo_info_bot`. After `APP_ENV=production`
    the unsuffixed bot is unused; decide whether to revoke it at BotFather.
  - Neither DEV nor PROD had `TelegramConnection` rows at audit time, so a live
    `/start link_` connect + notification delivery smoke could not be completed
    without the owner opening the bot.
  - Historical reports still mention `/api/telegram/webhook` (`docs/reports/*`);
    live docs/scripts now point at `/api/bot/webhook`.
  - DEV and PROD currently share one Resend API key fingerprint. Acceptable for
    one verified domain; split keys later if billing/isolation is required.
  - This audit's code fix is not deployed to PROD (explicitly out of scope).
    PROD `.env` must keep `APP_ENV=production` before the next PROD image roll,
    or Telegram would fall through to DEV credentials.
  - `src/server/email/send-welcome-email.ts` (`resolveWelcomeCtaUrl`) still
    catches a missing `APP_PUBLIC_URL`/`NEXT_PUBLIC_APP_URL` and falls back to
    a hardcoded `https://mamago.by` CTA link, same anti-pattern this audit
    removed from `activationEmailDelivery.ts`. Currently unreachable (both env
    vars are configured in DEV/PROD per this audit), so left as-is rather than
    changing welcome-email behavior without a product decision on what should
    happen when the public URL is unset (skip send vs. use a documented
    default) — not fixed in this task to keep scope narrow.
- Current state: code + tests landed on `dev`; DEV runtime env/webhook updated
  in the audit session; PROD image unchanged.
- Dependencies: owner Telegram connect on `@mamago_dev_bot` and `@mamaGo_info_bot`;
  next PROD deploy of this commit.
- Acceptance criteria: owner-connected Telegram smoke SENT on both bots;
  unsuffixed PROD token retired or documented as intentional; historical
  webhook docs either archived or updated; PROD running the APP_ENV-aware image.
- Source: Telegram Bot + Resend production-readiness audit (2026-08-19)

---

## [BACKLOG-124] Article REGION scope — deferred follow-ups

- Status: OPEN
- Priority: P3
- Area: Articles / Admin / Discovery
- Added: 2026-08-20
- Reason deferred: out of scope for the REGION-scope pre-release task
  (feat/article-region-scope, base caa4af21) — kept minimal per task
  instructions; noted here instead of expanding scope silently.
- Context:
  - Admin publications index (`src/lib/article/listArticlesForPublicationsIndex.ts`,
    `PublicationListRow.cityOrContext`) has no region label — a REGION
    article shows `cityOrContext: "—"` in `/admin/content/publications`,
    same as COUNTRY. Not a bug (nothing breaks), just no visual
    distinction for editors browsing the list. Would need a
    `regionSlug`/label field threaded through similarly to `citySlug`.
  - "Continuous reading" (read-next-in-section on `/blog/[slug]` and
    `/{city}/blog/[slug]`, `src/lib/article/nextArticleInSection.ts` +
    `nextArticleInSectionQuery.ts` + `buildContinuousArticleSeed.ts`) only
    activates when `continuous.geoScope === "COUNTRY"` (national route) or
    `"CITY"` (city route). REGION articles safely fall back to the
    `standalone` article view (verified: `loadArticleContinuousContext`
    returns a normal `GeoScope | null`, no crash) — they just never get a
    "next article" chain. Extending it means deciding what "next" means
    for REGION (same region only? national pool?) — a product decision,
    not a mechanical extension.
  - Local/DEV DB had only one Belarusian oblast (`minskaya-oblast`) with
    exactly one non-Minsk City linked to it (Марьина Горка) before this
    task; the other 5 oblasts were added to `prisma/seed.ts` and applied
    locally, but **no City row exists yet for Vitebskaya oblast** (or any
    oblast besides Minsk). The owner's planned DEV smoke test ("REGION
    article appears in the relevant city feed for a city in Vitebskaya
    oblast") needs at least one real City with
    `regionId = <vitebskaya-oblast id>` to exist on DEV first — either
    seed one, or set `regionId` on an existing DEV city that's actually
    in that oblast. Not done in this task: inventing city data (coords,
    metro flags, etc.) beyond the region reference rows themselves was
    judged out of the minimal-scope instruction.
- Current state: REGION scope shipped (schema, validation, editor,
  discovery for CITY/journal/tags surfaces); the three items above are
  deliberately not addressed.
- Dependencies: none blocking; (3) blocks a specific owner smoke-test
  scenario until a Vitebsk-region city exists on DEV.
- Acceptance criteria: (1) admin list shows a region label for REGION
  articles; (2) continuous-reading has an explicit REGION policy decision
  and implementation; (3) DEV has at least one City per Belarusian oblast
  (or at minimum Vitebskaya) with `regionId` set.
- Source: Article REGION geo scope feature (2026-08-20)

## [BACKLOG-125] Full LOCAL/GitHub/DEV/PROD sync audit (2026-08-20) — findings

- Status: OPEN
- Priority: P2
- Area: Git / Environment / Process
- Added: 2026-08-20
- Reason deferred: audit found no broken state requiring immediate action —
  LOCAL/origin/dev/DEV are exactly in sync and PROD is stable on a known-good
  past commit; remaining items are owner-decision/process gaps, not defects.
- Context:
  - LOCAL `dev` HEAD `09f0fa9e` == `origin/dev` HEAD (0 ahead/0 behind,
    verified via `git fetch --all` + `git rev-list --left-right --count`).
  - Live DEV (`https://dev.mamago.by/api/health`) confirmed
    `buildId=dev-329`, `gitSha=09f0fa9ec75c18c37c928b9b5963b97153b9f9c5` —
    exact match to LOCAL/origin/dev HEAD.
  - Live PROD (`https://prod.mamago.by/api/health`) confirmed
    `buildId=dev-326`, `gitSha=caa4af2171359d865fd05127704db5a428fb496a`
    (`fix(media): remove import source leakage`) — 3 commits behind current
    `dev` (missing: `23902410` content-success popup fix, `4f21400a`/
    `c33bf016`/`22b9af44` Article REGION geo scope, `09f0fa9e` public header
    REGION/COUNTRY fix). This is the expected immutable-promotion lag (PROD
    is only promoted deliberately, not on every dev push per
    `.github/workflows/docker.yml`) — not a defect. Confirmed no drift: the
    PROD `gitSha` is a real ancestor commit on `origin/dev`, not an
    off-branch hotfix.
  - **SSH to the app host (`mamago-prod` alias → `134.17.17.134`) times out
    from this Claude Code sandbox environment** (both normal and
    `dangerouslyDisableSandbox` mode) — outbound TCP/22 appears blocked at
    the network level even though HTTPS (git fetch, `gh`, `curl` to
    `*.mamago.by`) works fine. This means `docker diff`/container-filesystem
    verification (catching a hand-edited-in-container hotfix that wouldn't
    show up in `gitSha`/build labels) **cannot be performed from this kind
    of session** — only from a shell with real SSH egress to that host.
    Prior sessions document the same host's SSH as intermittently flaky
    (see `docs/release/dev-to-prod-checklist.md` line ~2697), so this may be
    session/network-specific rather than a host-side problem; worth
    confirming next time SSH is available.
  - Stale local branches/worktrees noise: 137 local branches exist, 28 have
    tips unreachable from any `origin/*` ref. Nearly all of these are
    **already tracked** — see BACKLOG-001 through BACKLOG-014 (worktree/
    branch hygiene cleanup, 2026-08-07 audit), which as of this session's
    fresh check still accurately describe the current state (e.g.
    `mamago2-admin-pagination` is still dirty with the same ~50-file
    pagination WIP BACKLOG-003 describes; `mamago2-rate-limit`,
    `mamago2-wp-legacy`, `mamago2-phoenix-checklist` still clean/unmerged as
    BACKLOG-010/011/012 describe). None of those items were re-litigated
    here — do not duplicate, just re-confirmed still OPEN and still
    accurate 13 days later.
- Current state: no changes made to any branch, worktree, or environment
  during this audit (read-only throughout, per explicit instruction).
- Dependencies: none blocking day-to-day `dev` work.
- Acceptance criteria: (1) owner decides if/when to promote `dev` HEAD to
  PROD (or confirms current PROD lag is fine); (2) next session with real
  SSH access to `mamago-prod` runs `docker diff` on both `dev-app-1` and
  `prod-app-1` to close the one verification gap this audit could not
  reach; (3) BACKLOG-001–014 eventually get their owner-decision merges/
  drops so the branch/worktree count stops growing.
- Source: full LOCAL↔GitHub↔DEV↔PROD audit, user-requested (2026-08-20)

## [BACKLOG-126] /me/ideas page doesn't surface Article/Place/Offer ideas

- Status: OPEN
- Priority: P2
- Area: My Ideas / Save
- Added: 2026-08-21
- Reason deferred: found while manually verifying the Article save-modal
  "ideaOnly" change (Article can now only save to `ArticleIdea`, never a
  dated `PlanItem`); the `/me/ideas` page and its data source only ever
  queried the Activity/Event `Idea` model, never `ArticleIdea`/`PlaceIdea`/
  `OfferIdea`. Fixing the Ideas page's data-fetching is out of scope for the
  save-modal task (which only touched the save UI/API, not the Ideas list),
  so it's recorded here instead of silently expanded into scope.
- Context: confirmed by grepping `src/app/(public)/me/ideas/` and
  `src/app/api/ideas` for `ArticleIdea`/`articleIdea` — zero hits. Manually
  verified end-to-end: registered a throwaway test user
  (`save-modal-test-2026@example.invalid`), saved a real article
  (`cms37q1ca0006ws27z75ug52h`) via the Save modal's "Сохранить в идеи"
  action, confirmed via `/api/save/status?articleId=...` that
  `isIdea: true, inPlan: false, planDate: null` and via a direct Prisma
  query that exactly one `ArticleIdea` row exists (no `PlanItem` row at
  all) — the save itself is correct. But `/me/ideas` still rendered
  "0 идей" / "Пока нет сохранённых идей" for that same user immediately
  after.
- Current state: `ArticleIdea` (and, per the same code-path, presumably
  `PlaceIdea`/`OfferIdea` too — not separately re-verified here) rows are
  written correctly and idempotently, and correctly excluded from any
  dated `PlanItem`/"Мой план" view. They are simply invisible on the
  dedicated "Мои идеи" list page. This predates the Article-save-modal
  ideaOnly change — it is a pre-existing gap in the Ideas page's data
  source, not a regression introduced by that change.
- Dependencies: none blocking the Article save-modal work itself.
- Acceptance criteria: `/me/ideas` (and its backing API route) queries
  `ArticleIdea`/`PlaceIdea`/`OfferIdea` alongside the Activity `Idea` model
  and renders them with appropriate per-type cards/links; a saved
  Article/Place/Offer idea shows up there and can be removed from that page
  too.
- Source: manual QA during Article save-modal ideaOnly implementation
  (2026-08-21)

## [BACKLOG-127] Admin-only upload-as-author override for article media

- Status: DONE (2026-08-22)
- Priority: P3
- Area: Admin / Media
- Added: 2026-08-22
- Renumbered: originally filed as "BACKLOG-004", which collided with the
  pre-existing `recovery/plan-suggestions-age-tags-null` entry at that ID —
  renumbered to the next free id (127) when closing, per backlog rule 5
  (closed entries are kept, not deleted).
- Reason deferred (original): `POST /api/upload` (`src/app/api/upload/route.ts`)
  always set `uploadedById: user.id` (the requesting user's own id) — there
  was no mechanism to attribute an upload to another user. Deferred at the
  time because it touches the shared upload endpoint used by every upload
  flow in the app, not just the article editor.
- Context: an ADMIN/MODERATOR editing another user's article could already
  *browse and pick* that author's existing media (fixed earlier the same
  day via `authorUserId` scoping on `/api/admin/articles/media-picker`),
  but uploading a *new* file from within that same editor landed in the
  editor's own library, not the article author's — so the freshly uploaded
  image would not show up next time the author (or another editor) opened
  that article's picker.
- Resolution: `POST /api/upload` (`src/app/api/upload/route.ts`) accepts two
  optional form fields, `ownerUserId` and `uploadContext`. Resolution is
  centralized in `resolveUploadOwnerUserId()`
  (`src/lib/uploads/resolveUploadOwner.ts`), deliberately narrower than the
  first draft of this fix (which let any ADMIN/MODERATOR override the owner
  for *any* `/api/upload` call — flagged as too broad on review and tightened
  before commit): the override is a no-op when `ownerUserId` is omitted or
  equal to the requester's own id (the case for every non-article upload
  flow); otherwise it requires **both** `uploadContext === "ADMIN_ARTICLE"`
  (a closed literal union, not a free-form string — a typo/garbage value
  fails closed to `null`) **and** the requester's role being ADMIN/MODERATOR,
  checked as two independent gates — neither is silently downgraded, each
  throws `UploadOwnerOverrideError("FORBIDDEN")` on its own. A dangling
  target id throws `UploadOwnerOverrideError("OWNER_NOT_FOUND")` rather than
  surfacing a raw FK-constraint error. Considered (per the task's own
  guidance) splitting this into a separate `/api/admin/articles/upload`
  endpoint reusing the existing processing/storage pipeline, but the
  pipeline (preflight, dedup, sharp processing, storage write, DB
  registration, response shaping) is ~180 lines of sequential logic in one
  handler with no extracted reusable core — duplicating a second route
  around it, or refactoring the whole pipeline into a shared function, was
  judged unjustified duplication/risk for a P3 fix; the explicit
  `uploadContext=ADMIN_ARTICLE` gate on the single existing endpoint was the
  allowed fallback and adds zero duplication. Plain `/api/upload` callers
  (business wizard, avatar, etc.) never send either field, so
  `uploadedById = user.id` unconditionally, byte-for-byte unchanged. The
  resolved id (not the requester's) is used for both the per-owner
  content-hash dedup lookup (`findOwnedMediaByContentHash`) and
  `registerUploadedMedia`'s `uploadedById`, so a duplicate re-upload for
  author A dedups against A's library, never the admin's.
  `uploadClient.ts`'s `uploadMediaFile()` grew matching `ownerUserId`/
  `uploadContext` options, both appended only when set.
  `ArticleEditorCoverField`/`ArticleEditorGalleryField`'s `uploadFiles` pass
  `{ ownerUserId: authorUserId, uploadContext: "ADMIN_ARTICLE" }` only when
  `authorUserId` is set (new/no-author-yet articles keep uploading to the
  current admin's own library, unchanged).
- Verification: `src/lib/uploads/resolveUploadOwner.test.ts` — no-op cases;
  USER + ownerUserId → `FORBIDDEN` (including with a forged
  `uploadContext=ADMIN_ARTICLE`, proving context alone isn't enough);
  BUSINESS_OWNER + ownerUserId → `FORBIDDEN` (same, including forged
  context); ADMIN (and separately MODERATOR) + ownerUserId **without** the
  `ADMIN_ARTICLE` context → `FORBIDDEN` (proving role alone isn't enough —
  this is the scenario the narrowing fixed); ADMIN + ownerUserId +
  `ADMIN_ARTICLE` context targeting a nonexistent user → `OWNER_NOT_FOUND`;
  ADMIN (and MODERATOR) + `ADMIN_ARTICLE` + real author A → resolves to A;
  and the full acceptance scenario end-to-end against a real DB: ADMIN B
  resolves+registers a `MediaAsset` for author A in the `ADMIN_ARTICLE`
  context, asserts `uploadedById === authorA` (not adminB), asserts the
  asset appears in author A's `queryMediaPickerPage` page and never in
  admin B's.
- Source: engineering audit + implementation during media-picker
  infinite-scroll work (see `mediaPickerQuery.ts` / `MediaUploadField.tsx` /
  `ArticleEditorCoverField.tsx` / `resolveUploadOwner.ts` changes)

## [BACKLOG-128] Model event intervals for discovery date overlap and density

- Status: BLOCKED
- Priority: P1
- Area: Discovery / Events / Data model
- Added: 2026-08-24
- Reason deferred: the current `ActivitySession` model contains `startsAt` only; there is no authoritative per-session `endsAt`, so interval overlap and expansion of one multiday session across every intersecting calendar day cannot be implemented without inventing semantics or changing the materialization contract.
- Context: discovery filters and `/api/calendar/density` now share the executable Activity/session predicates and Minsk timezone policy. They correctly count materialized session days, but cannot infer an event interval that the schema does not store.
- Current state: `buildEventRuntimeWhere` matches sessions whose `startsAt` is inside the selected half-open window. Density replaces applied dates with its visible-month window and groups matching materialized sessions by Minsk date.
- Dependencies: product/data decision for session duration vs activity-level interval, schema migration adding an authoritative end boundary (or an explicit guarantee that multiday events materialize one session per active day), importer/wizard backfill rules.
- Acceptance criteria: authoritative interval semantics are documented; schema/materialization and backfill are implemented; shared overlap predicate matches `start < filterEnd AND end >= filterStart`; density expands an interval into each intersecting Minsk day; fixtures cover an event starting before TODAY and remaining active today, plus month/year boundaries.
- Source: discovery filters completion audit, base `961f8bae`, 2026-08-24

## [BACKLOG-129] Normalize event prices for executable discovery ranges

- Status: BLOCKED
- Priority: P1
- Area: Discovery / Events / Pricing data model
- Added: 2026-08-24
- Reason deferred: `priceFrom`/`priceTo` are not authoritative across the event wizard, tariff `priceItems`, and imported text prices; exposing a range slider or histogram now would silently omit or misclassify events.
- Context: the discovery filter sheet currently exposes the executable “Бесплатно” predicate. Owner-review requested a min/max price control only if the stored data could support honest filtering and distribution counts.
- Current state: the wizard writes the primary fixed/from price into `priceFrom` and writes tariff rows independently to JSON `priceItems`; free events may be represented by `scheduleJson.pricingMode = "free"` and/or a zero price; import performs best-effort parsing of `priceText`; no executable `priceMin`/`priceMax` predicate or price-distribution endpoint exists.
- Dependencies: product semantics for “от”, tariff minima/maxima, session-specific prices and currency conversion; an authoritative numeric projection such as `effectivePriceMin`/`effectivePriceMax` (or a strict replacement contract for `priceFrom`/`priceTo`); writer and importer updates.
- Acceptance criteria: explicit free status remains independent from paid ranges; all write paths populate an authoritative BYN numeric min/max projection; a migration/backfill derives safe values from structured pricing modes and `priceItems`, reports coverage, and quarantines unparseable text for manual review; list/count/distribution use one shared executable predicate; fixtures cover free, fixed, from, ranged, multi-tariff, imported, and unknown prices; the range UI is enabled only after measured coverage is accepted.
- Source: event discovery filter owner-review audit, base `a01101c0`, 2026-08-24

## [BACKLOG-130] Batch /api/save/status for Event/Place/Offer card grids

- Status: OPEN
- Priority: P2
- Area: Save / Discovery / Performance
- Added: 2026-08-25
- Reason deferred: fixing this is a bounded batch-endpoint feature (schema, N new API route, wiring into 3 different card components), out of scope for the guest-401/duplicate-request bugfix that motivated this audit; that fix only needed to stop guest and duplicate requests, not eliminate legitimate authenticated N+1.
- Context: `SaveHeart` (used by `EventCard`, `OfferCard`, `ActivityCard`) has no batch path — every card on a list page does its own `GET /api/save/status` on mount. For an authenticated user viewing e.g. 20 event cards, that's 20 individual requests. `ArticleSaveHeart` already solved the same problem for article grids via `useArticleSaveStatusBatch` + `POST /api/save/status/articles` + `skipOwnFetch`/`initialStatus` props (see `src/features/save/useArticleSaveStatusBatch.ts`, `src/app/api/save/status/articles/route.ts`) — that pattern is the template to replicate, not a new design.
- Current state: `PlaceSaveHeart` has no batch path either (no grid currently renders many `PlaceSaveHeart` at once, so lower urgency there). `EventCard`/`OfferCard`/`ActivityCard` grids (e.g. city home rows, discovery listing, activity listing) each mount `SaveHeart` directly with per-card fetch, now correctly guarded against guest/duplicate requests but still N+1 for authenticated users.
- Dependencies: none blocking; needs a batch status endpoint keyed by activityId/offerId (mirroring the article one, which already handles idea+plan state per entity) and a `useSaveStatusBatch`-style hook, then wiring the owning grid components to pass `initialStatus`/`skipOwnFetch`-equivalent props into `SaveHeart`.
- Acceptance criteria: authenticated card grids for events/offers/activities issue one batched status request per page instead of one per card; `SaveHeart`'s own-fetch path remains for standalone (non-grid) usage; guest behavior (no request at all) is unaffected.
- Source: `/api/save/status` guest-401/duplicate-request audit, base `772bdc1f`, 2026-08-25

## [BACKLOG-131] PROD had no NAT hairpin/loopback for its own public IP — health_endpoint/sitemap_unavailable/global_noindex all failing on PROD

- Status: DONE
- Priority: P0 — Operations Center was blind on the actual PROD stack (3 of 7 detectors permanently red/never-run)
- Area: Infra / PROD host networking (`134.17.17.134`, `/opt/mamago/prod`)
- Added: 2026-08-25
- Resolved: 2026-08-25
- Context: Operations Center `health_endpoint`, `sitemap_unavailable`, and
  `global_noindex` all read their base URL from the single
  `getCanonicalPublicAppUrl()` helper (`src/lib/config/publicAppUrl.ts`),
  which on `prod-worker-1` resolved to `APP_PUBLIC_URL=https://mamago.by`
  — correct and explicitly configured, not a stale fallback. `mamago.by`
  DNS points at `134.17.17.134`, the same floating public IP as the host
  itself. `prod-worker-1`/`prod-app-1` sit on the PROD docker network
  (`prod_prod_net`, subnet `172.20.0.0/16`), a sibling of the DEV network
  (`172.19.0.0/16`) on the same physical host. Exactly the same bug as
  BACKLOG-121 (DEV, resolved 2026-08-16) — except BACKLOG-121's fix was
  deliberately scoped to the DEV subnet only ("no PROD subnet
  (`172.20.0.0/16`) match"), and no equivalent PROD rule was ever added.
- Root cause: missing PROD-container hairpin to the upstream floating IP.
  `curl https://mamago.by/api/health` from the host itself, from
  `prod-app-1`, and from `prod-worker-1` all hung to an 8s connection
  timeout (TCP SYN goes out to the upstream NAT for the host's own public
  IP, which never hairpins the connection back to local Traefik).
  Confirmed externally reachable and fast (`/api/health` 200 in 0.38s,
  `/sitemap.xml` 200 in 0.38s, `/robots.txt` 200 in 0.32s) the entire time
  — this was purely an intra-host routing gap, never a real outage or an
  app/SEO bug. `health_endpoint`/`sitemap_unavailable` degrade a caught
  network error into a CRITICAL signal (`DetectorRun.status` stays `OK`);
  `global_noindex`'s `probeGlobalNoindex` does not catch its `fetch`
  calls, so the same transport failure threw instead, and
  `DetectorRun.status` was never `OK` — the exact mechanism behind
  `detector_stale`'s "Never completed a successful run" for
  `global_noindex` specifically (see `src/server/ops/detectors/detectorStale.ts`).
- Fix: one PROD-source-subnet-scoped HTTPS DNAT only, mirroring BACKLOG-121's
  rule shape exactly:
  `-s 172.20.0.0/16 -d 134.17.17.134 -p tcp --dport 443`
  → `192.168.185.209:443` (local Traefik publish). No OUTPUT rules, no
  port 80, no MASQUERADE, DEV's own rule/service left untouched.
- Persistence: `/etc/systemd/system/mamago-prod-hairpin.service` (oneshot,
  `iptables -C || -I`, enabled; ExecStop removes the same rule) — sibling
  of `mamago-dev-hairpin.service`, not a modification of it.
- Verification: `curl` from `prod-worker-1` to `/api/health`, `/sitemap.xml`,
  `/robots.txt`, `/` all <0.2s with 2xx/307 after the fix. Operations
  Center worker logs confirm all three detectors green post-fix:
  `health_endpoint status=OK` (`signalsResolved=1`), `sitemap_unavailable
  status=OK`, `global_noindex status=OK` (previously `FAILED` — first
  `OK` run ever recorded for this detector on PROD).
- Source: Operations Center PROD audit + BACKLOG-121-pattern host fix
  (2026-08-25)

## [BACKLOG-132] GA4/Yandex server-side reconciliation for /admin visitor KPIs

- Status: OPEN
- Priority: P1
- Area: Analytics / /admin dashboard
- Added: 2026-08-26
- Context: The /admin dashboard rework (North Star, habit, funnel — see
  `src/app/admin/page.tsx`, `src/lib/admin/dashboardViewModels.ts`,
  `src/lib/admin/metricDictionary.ts`) ships every visitor-derived KPI
  (MAU/WAU/WPF/W1-W4 retention/3-of-4-week habit) as `PROVISIONAL`, never
  `VERIFIED`, because no server-side pull from GA4 Data API or Yandex
  Metrica Reporting API exists — only client-side gtag/ym script injection
  (`src/lib/analytics/externalAnalyticsConfig.ts`). Flipping `verifiable:
  true` on the affected `METRIC_DICTIONARY` entries in
  `src/lib/admin/metricDictionary.ts` is the entire promotion mechanism once
  this ships.
- Blocked on: GA4 service-account credentials with Data API access, and a
  Yandex Metrica OAuth token + counter ID — not available as of 2026-08-26,
  explicitly deferred by Aleksei to a later phase.

## [BACKLOG-133] No first-party acquisition-source (UTM/referrer) tracking

- Status: OPEN
- Priority: P2
- Area: Analytics / /admin dashboard
- Added: 2026-08-26
- Context: The dashboard spec's Growth (Organic/Direct growth) and
  Acquisition Quality (Organic/Direct/Referral/Social split + activation by
  source) blocks are not implemented — `deriveGrowth()` in
  `src/lib/admin/dashboardViewModels.ts` and `GrowthBlock.tsx` render an
  explicit "нет проверенных данных" placeholder for this. Research during
  planning found no UTM/referrer capture at signup; this is unconfirmed by a
  fresh grep at implementation time and should be re-verified before
  starting. Either first-party capture or GA4/Yandex reconciliation
  (BACKLOG-132) could unblock this.

## [BACKLOG-134] RouteIdea / DayScenario / route-PlanItem writes emit no UserEvent

- Status: OPEN
- Priority: P2
- Area: Analytics instrumentation
- Added: 2026-08-26
- Context: `src/server/services/analytics/planningActivity.ts` (Weekly
  Planning Families / W1-W4 retention / 3-of-4-week habit) has to read
  `RouteIdea`, `DayScenario`, and `PlanItem` directly because none of their
  write paths (`src/server/services/idea.service.ts:addRouteIdea`,
  `src/app/api/save/plan/route.ts`'s `routeId` branch, `dayScenario.service.ts`)
  call `trackUserEvent`. Same class of gap as BACKLOG-029 (missing `SHARE`
  event type). Worth its own event-type/instrumentation pass so future
  analytics don't need bespoke per-table queries.

## [BACKLOG-135] B2B repeat-promotion rate and revenue have no honest signal

- Status: OPEN
- Priority: P2
- Area: B2B analytics / monetization
- Added: 2026-08-26
- Context: `deriveB2BHealth()` (`src/lib/admin/dashboardViewModels.ts`)
  hard-codes `repeatPromotionRate: null` and `revenue: null` — paid
  `Promotion` create/resume both throw `"...not available in first
  PROD. Use explicit Boost purchase."` (`src/server/services/promotion/promotion.service.ts`),
  and `registerPromotionActionFromUserEvent()` is a no-op. No reliable
  revenue definition/source exists either. Revisit once/if paid Promotion or
  a stable Boost-revenue accounting exists — do not fabricate a placeholder
  metric before then.

## [BACKLOG-136] Supply "coverage gaps" enumeration not implemented

- Status: OPEN
- Priority: P3
- Area: /admin dashboard — Supply Health
- Added: 2026-08-26
- Context: The dashboard spec's §8 "Coverage gaps" (categories/dates/
  districts with critically low supply) needs a threshold definition for
  "critically low" that only Aleksei can set — not attempted in the
  dashboard rework. `SupplyHealthBlock.tsx`/`supplyHealth.ts` cover active
  events/places/offers + freshness only.

## [BACKLOG-137] No MetricSample range-query/trend-chart consumer exists

- Status: OPEN
- Priority: P3
- Area: /admin dashboard / Operations Center metrics
- Added: 2026-08-26
- Context: `MetricSample` is indexed for range scans
  (`[metric, dimKey, collectedAt DESC]`) and now carries real history for
  every dashboard KPI, but every current consumer (`metricProjection.ts`,
  and the dashboard rework's `_prev`-companion-metric growth deltas) only
  does single-point lookups — no genuine range query for a sparkline/trend
  chart exists anywhere. Building one is net-new work, not a fix to
  anything broken.
