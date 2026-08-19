# Database Migrations

Source of truth for the local database is the combination of:

- `prisma/schema.prisma`
- `prisma/migrations/*`
- `_prisma_migrations` in PostgreSQL

Do not use these on a working local database:

- `prisma db push`
- `prisma migrate dev`
- manual SQL that changes schema without a matching migration history decision

Safe local flow:

1. `pnpm db:preflight`
2. `pnpm db:migrate:status`
3. `pnpm db:migrate:deploy`
4. `pnpm prisma db seed`

If the database has application tables but no `_prisma_migrations`:

- stop immediately;
- do not run `migrate deploy`;
- either recreate the local DB from scratch or restore migration history deliberately.

If you already applied SQL manually:

- stop before the next Prisma command;
- inspect the difference between DB, schema, and migrations;
- use a deliberate repair path instead of `db push`.

How to recreate the local DB safely:

1. Confirm `DATABASE_URL` points to local Docker/Postgres.
2. Take a safety dump.
3. Stop local compose.
4. Remove only the local Postgres volume.
5. Start `db`.
6. Run `pnpm db:migrate:deploy`.
7. Run `pnpm prisma db seed`.

Rule of thumb:

- keep schema refactors separate from product-feature migrations;
- do not mix cleanup/refactor work with a new feature migration in one step.
