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

- Status: OPEN
- Priority: P0
- Area: Migration / Environment / Process
- Added: 2026-08-07
- Reason deferred: not deferred — flagged as release-process-critical, but
  the fix (deciding/documenting the real DEV access path) is the project
  owner's decision, not something an agent session can resolve unilaterally
  without credentials/scope it doesn't have.
- Context: Task 1 (Import Images Into DEV) ran a full write session against
  `DATABASE_URL=postgresql://mamago:mamago@localhost:5433/mamago2`
  (container `mamago2-db`) under the working assumption that this local
  Docker Postgres + local `storage/uploads/` constituted "DEV" per this
  checklist. The owner later checked the real `https://dev.mamago.by`
  (DNS: `134.17.17.134`, confirmed distinct from `localhost:5433`) and
  found the imported media absent. Read-only reconciliation confirmed: (1)
  the local Postgres container is a purely local Docker volume created
  2026-06-22, not shared/remote storage; (2) real `dev.mamago.by` Place
  pages that were legitimately published in the 2026-07-28/29 sessions
  show correct content but none of this session's newly-imported gallery
  images; (3) an Event and an Article present in the local DB do not exist
  on real DEV at all (404), meaning the local DB has diverged from real
  DEV in content, not just media. No credentialed path from this
  environment to the real DEV Postgres/storage or admin panel was found;
  the one plausible network route (SSH to `134.17.17.134`) is locally
  aliased `mamago-prod` in `~/.ssh/config`, which was deliberately not
  used without explicit owner confirmation of scope/safety.
- Current state: not started. Every future coding-agent session that
  writes to "DEV" under the current `.env`/docs setup risks repeating this
  exact mistake — this is a systemic gap, not specific to media import.
- Dependencies: owner decision on (a) what the real DEV access path is for
  an agent session (DB URL, storage target, or a documented sync
  mechanism), and (b) whether `~/.ssh/config`'s `mamago-prod` alias for
  `134.17.17.134` is correctly named (it currently reads as "prod" for a
  host that DNS says is "dev", which is itself worth the owner's
  attention independent of this backlog item).
- Acceptance criteria: `docs/release/dev-to-prod-checklist.md` (or
  `CLAUDE.md`) updated with an explicit, unambiguous description of how an
  agent session reaches the real DEV database/storage safely — or an
  explicit statement that local Docker Postgres is the intentional
  working tier and a separate, owner-run sync step deploys it to real DEV
  (in which case *that* sync step becomes the actual Task 1 gap).
- Source: `docs/release/dev-to-prod-checklist.md` Task 1 environment
  reconciliation (owner-reported media not visible in actual DEV)
