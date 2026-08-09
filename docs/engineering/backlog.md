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

- Status: OPEN
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
- Current state: not started.
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
  generic `RouteCommitRunner` UPDATE path, and `RouteCommitRunner.ts` has
  **no** `TARGET_MODIFIED_AFTER_IMPORT`-equivalent (or hash-equality)
  conflict guard at all (confirmed by reading the file — no
  `classifyRouteUpdateSafety` module exists, unlike Place). A plain
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
- Current state: not attempted. 0 Routes/RouteStops touched this session.
  All 14 Routes/90 RouteStops render cleanly with no images today (no
  broken `<img>`, confirmed via code read of `RouteCard`/`RouteDetailClient`
  — see Task 1 audit), so this is not a P0/P1 visual-breakage risk, just an
  incomplete production-like dataset for this one entity type.
- Dependencies: needs either (a) a `classifyRouteUpdateSafety`-equivalent
  guard added to `RouteCommitRunner` (mirroring Place), or (b) a dedicated
  `--force-route-media-replay` narrow path (mirroring Event/Article) before
  any Route media backfill is safe to run.
- Acceptance criteria: safety net built and verified; then Route/RouteStop
  media backfill can run safely.
- Severity review (2026-08-07, Task 1 closure): confirmed **not** P0/P1.
  Routes are a small, secondary entity (14 total, vs. 83 Places/26
  Articles), already render cleanly with no broken images or layout
  regression, and are not one of Task 1's core "main sections" (Places,
  Articles, Events). Lack of Route/RouteStop imported media does not
  materially prevent production-like DEV testing of the core discovery
  flows and does not make first PROD unsafe. Stays P2, does not block
  Task 1 `COMPLETE`.
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

- Status: OPEN
- Priority: P2
- Area: Business / Analytics
- Added: 2026-08-08
- Reason deferred: explicitly allowed to defer per
  `docs/release/dev-to-prod-checklist.md` Task 3 §18 ("Business dashboard
  не входит фактически в Task 3 Exit Criteria — зафиксировать и оставить
  расширение в backlog"); a materially similar, correctly business-scoped
  per-publication performance view already exists on `/business/dashboard`
  (`getBusinessWorkspaceData`/`getPerformanceMetricsByEntity`, server-side
  scoped by `businessId`/`ownerUserId` — verified no cross-business leak).
  An empty page cannot leak data, so this is a UX gap, not a security gap.
- Context: `src/app/business/(protected)/analytics/page.tsx` is a 14-line
  file rendering only `<BusinessSectionHeader ... description="Раздел в
  разработке" />` — no data fetching at all.
- Current state: not started.
- Dependencies: product decision on whether to build a dedicated Business
  Analytics page or redirect/fold this route into the existing Dashboard
  view.
- Acceptance criteria: either a real per-business analytics page (reusing
  `getBusinessWorkspaceData` / the same query patterns already proven safe)
  or the route is removed/redirected — decided by product owner.
- Source: `docs/release/dev-to-prod-checklist.md` Task 3 audit
  (Publication Analytics)

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
