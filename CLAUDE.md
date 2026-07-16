# mamaGo — заметки для агентов

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
