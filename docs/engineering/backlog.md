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
