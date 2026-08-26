# mamaGo — заметки для агентов

> **CRITICAL: Before using or merging any agent/worktree output, verify its base SHA against the current repository HEAD. Never copy stale worktree files over newer repository files.**

## Task Start / Environment Consistency — mandatory for EVERY new task

A **new task** is any distinct user request that may change repository files, including a new request inside the same chat/session. This protocol is mandatory before implementation starts.

1. In the canonical `dev` checkout run:

```bash
sh scripts/git/session-start-gate.sh
```

2. Continue only after `PASS`: local `HEAD` must exactly match freshly fetched `origin/dev`. If the gate reports stale, ahead, diverged, tracked/staged WIP, or cannot fetch the remote, STOP. Do not repair the state with `reset --hard`, force-push, broad checkout/restore, or automatic pull/rebase.
3. Capture the exact clean base SHA:

```bash
BASE_HEAD=$(git rev-parse HEAD)
```

4. Every implementation task must run in its **own isolated task worktree/branch created from that exact `BASE_HEAD`**. Do not implement a new task directly in a shared worktree, and do not reuse an old task worktree for a different task without re-validating it against fresh `origin/dev`.
5. Before integrating, committing to a shared branch, or pushing task output, fetch `origin/dev` again and compare it with `BASE_HEAD`. If `origin/dev` advanced, treat the task output as potentially stale: reconcile deliberately on top of the fresh base, inspect overlapping files, and rerun relevant verification before integration.
6. Git/GitHub commit SHA is the source of truth. `local`, DEV, and PROD are environments, not independent code histories. Never make manual code edits directly on DEV or PROD.
7. After deployment, verify that the environment reports the expected `gitSha`/build identity before claiming the change is deployed. PROD must come from a known, verified Git commit/artifact; never treat server filesystem state as authoritative source code.

**Core task-start rule:** fresh `origin/dev` → exact `BASE_HEAD` → isolated task worktree/branch → verified integration → deployment identity check. If freshness cannot be proven, repository-changing work does not start.

## Git / Worktree Safety — mandatory

Правила обязательны для любых параллельных задач, subagents, background agents и временных worktree.

### 1. Всегда проверять base SHA

Перед созданием worktree или запуском agent-задачи зафиксировать текущую базу:

```bash
BASE_HEAD=$(git rev-parse HEAD)
git rev-parse --abbrev-ref HEAD
git status --short
```

После создания worktree:

```bash
git rev-parse HEAD
```

SHA внутри worktree ОБЯЗАН совпадать с `BASE_HEAD`.
Если SHA не совпадает — STOP.
Не начинать работу в worktree с неправильной или устаревшей базы.

### 2. Никогда не предполагать, что worktree создан от текущего HEAD

Запрещено полагаться на implicit/default branch state.
Worktree создавать явно от зафиксированного SHA:

```bash
git worktree add --detach <path> "$BASE_HEAD"
```

### 3. Запрещено переносить результат worktree через `cp`, `rsync` или полную замену файлов

Нельзя делать:

```bash
cp ...
rsync ...
```

из agent/worktree обратно в основной working tree, если файл мог измениться после создания worktree.
Это может тихо откатить уже существующую работу.
Результат переносить только через:

- patch;
- cherry-pick;
- точечное повторное применение diff;
- rebase/merge после проверки актуальной базы.

### 4. Перед интеграцией проверить, ушёл ли основной HEAD вперёд

Перед переносом результатов:

```bash
CURRENT_HEAD=$(git rev-parse HEAD)
```

Сравнить с `BASE_HEAD`.
Если `CURRENT_HEAD != BASE_HEAD`, считать результат агента потенциально устаревшим.
Проверить:

```bash
git diff --name-only "$BASE_HEAD".."$CURRENT_HEAD"
```

и пересечение этого списка с файлами, изменёнными агентом.
Если один и тот же файл менялся и в agent worktree, и после `BASE_HEAD` в основном репозитории — запрещено заменять его целиком.
Изменения агента нужно переприменить поверх актуального HEAD вручную либо через корректный patch/rebase.

### 5. Foreign work-in-progress не трогать

Перед задачей определить существующий foreign diff:

```bash
git status --short
```

Не восстанавливать, форматировать, исправлять, stage, commit или удалять чужие незакоммиченные изменения, если они не входят прямо в scope текущей задачи.

### 6. Никогда не использовать широкий staging в грязном рабочем дереве

Если присутствует foreign diff, запрещено:

```bash
git add .
git add -A
git commit -am ...
```

Использовать только explicit staging:

```bash
git add path/to/file1 path/to/file2
```

Если один файл содержит и свои, и чужие изменения — использовать selective/hunk staging.
Перед commit обязательно:

```bash
git diff --cached --name-status
git diff --cached --stat
git diff --cached --check
```

### 7. Изолированная проверка при параллельном foreign diff

Если общий `build`, `typecheck`, тесты или `check:push` падают из-за чужой незавершённой работы, нельзя автоматически считать текущую задачу сломанной. Нужно:

1. создать чистый worktree от актуального `BASE_HEAD`;
2. применить только patch текущей задачи;
3. запустить полный project gate;
4. зафиксировать результат.

Если `BASE_HEAD + task patch = green`, а основной working tree остаётся red из-за foreign diff — task может быть независимо признана технически валидной.

### 8. Проверять base после долгих background-задач

После завершения любого background/subagent процесса, особенно если он работал долго, повторно проверить:

```bash
git rev-parse HEAD
```

и сравнить: base агента; текущий HEAD основного репозитория; список затронутых файлов.
Нельзя считать результат безопасным только потому, что agent завершился успешно.

### 9. При crash / usage limit / interrupted agent

Если subagent или background agent завершился аварийно:

- не копировать его рабочее дерево целиком;
- сначала определить, какие изменения реально были сделаны;
- проверить его base SHA;
- сравнить его base с текущим HEAD;
- переносить только проверенный diff.

Частично выполненная задача не является основанием для полной замены файлов.

### 10. Защита от silent rollback

Перед интеграцией большого agent diff выполнить проверку пересечения:

```
files changed by agent
∩
files changed in BASE_HEAD..CURRENT_HEAD
```

Если пересечение непустое — каждый такой файл требует отдельной проверки. Особенно опасны:

- большие уменьшения количества строк;
- исчезновение новых компонентов;
- возврат старых API/props;
- восстановление ранее удалённого кода;
- внезапные diff на сотни строк при простой локальной задаче.

### 11. Не исправлять unrelated ошибки ради зелёного gate

Если проверка обнаружила ошибку вне scope:

- доказать, что она pre-existing/foreign;
- зафиксировать её отдельно;
- не исправлять её молча;
- не расширять scope задачи без явного решения.

### 12. Финальный Git Gate перед commit

Для любой задачи с несколькими файлами обязательно:

```bash
git status --short
git diff --stat
git diff --check
git diff --cached --name-status
git diff --cached --stat
git diff --cached --check
```

Для крупных или параллельных изменений дополнительно проверить task-only diff в чистом worktree.

**Core rule:** Agent output is a diff, not a source of truth. Актуальный `HEAD` основного репозитория всегда имеет приоритет над содержимым старого worktree. Никогда не заменять актуальный файл старой версией только потому, что она содержит нужное изменение агента. Нужное изменение должно быть переприменено поверх актуального кода.

## DEV → PROD Readiness

For any DEV → PROD readiness work, read `docs/release/dev-to-prod-checklist.md`
first and treat it as the release coordination source of truth. Use AUDIT
FIRST, implement only confirmed gaps, use risk-based verification, make
atomic commits after completed verified phases, route non-blocking P2/P3
engineering work to `docs/engineering/backlog.md`, and update checklist
status/proof after completion. Do not expand the frozen release scope with
non-blocking work.

## Engineering Backlog

Any consciously deferred engineering task must be recorded in
`docs/engineering/backlog.md` before the current task is considered complete.
This is separate from `docs/migration/prelaunch-checklist.md` (release-blocking
migration work) — the backlog is for deferred work / technical debt / cleanup
/ follow-up decisions. See that file's own rules for format and status
conventions.

## Миграция WordPress (Project Phoenix)

- Прогресс и порядок работ: **`docs/migration/prelaunch-checklist.md`** —
  единственный источник истины. Любая работа по миграции начинается с чтения
  этого файла (включая раздел «Правила работы», пункт 7 — ускоренный
  PR/Docker workflow) и заканчивается обновлением его статусов + записью в
  журнал сессий (handoff log) внизу файла — **пакетно, по завершении
  сущности/фазы, не после каждого мелкого PR**.
- Продуктовые решения из чек-листа агент не принимает сам — спрашивает Алексея.
- **PR/Docker workflow для серии мелких fix-PR:** targeted tests + targeted
  lint + `tsc --noEmit` для каждого PR; полный `pnpm build` не повторять
  вручную, если тот же build уже прошёл через pre-push hook; один Docker
  Build & Push на merge SHA, дальше не ждать в сессии; отдельный docs-коммит
  после каждого PR — не делать, обновлять чек-лист пакетно; не polling
  GitHub Actions в цикле. Полный sweep/build/Docker обязателен только на
  фазовых воротах (первый реальный write, full batch, RC, production
  cutover) — см. чек-лист, пункт 7, для полного списка.

## Prisma-миграции (ВАЖНО)

- `prisma migrate dev` в этом репо **не используется и не работает**: миграция
  `20260608114243_city_scoped_slugs` создала partial unique-индексы
  (`WHERE … IS NOT NULL`), которые невыразимы в schema.prisma → Prisma всегда
  видит «дрифт» и предлагает **reset базы. Никогда не соглашаться на reset.**
- Миграции пишутся **вручную**: каталог `prisma/migrations/YYYYMMDDHHMMSS_meaningful_name/`
  с `migration.sql` (SQL в стиле prisma-generated), применение — `npx prisma migrate deploy`.
- Применённые миграции **никогда не редактируются** (checksum в `_prisma_migrations`
  ломается). Нужны правки — новая миграция.
- `prisma db push` запрещён.
- env для CLI: `prisma.config.ts` не подхватывает .env автоматически —
  запускать как `set -a; source .env; set +a; npx prisma …`.

## Auth callbackUrl / redirectTo

Current behavior:
- Auth (login/register) supports a safe return-to-origin redirect via the
  `redirectTo` query param (legacy alias: `next`). All capture and resolution
  goes through `getSafeRedirectPath()` in `src/lib/auth/redirectTo.ts` — the
  single source of truth, no duplicated validation in components.
- After successful login/registration, the user returns to the page where
  auth was initiated (`nextHref` for modal flows, `redirectTo` query param for
  page flows). Falls back to `/me` if no valid target exists.

Security (`getSafeRedirectPath`):
- Only internal relative paths are allowed.
- External URLs, protocol-relative URLs (`//evil.com`), and auth-flow pages
  themselves (`/auth`, `/login`, `/register`, `/profile-entry`) are rejected
  as redirect targets to avoid open redirects and redirect loops.

Planned extension:
- Add an optional `intent` param to resume the original action (not just the
  page) after auth, e.g. `/login?redirectTo=/minsk/events/slug&intent=add-to-plan`.
- Not implemented yet — do not add `intent` without a dedicated task.
