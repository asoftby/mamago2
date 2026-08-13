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
