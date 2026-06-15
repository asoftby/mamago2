# mamaGo — заметки для агентов

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
