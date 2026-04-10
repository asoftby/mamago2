# mamaGo 2.0 — Data Policy

## Core Rules

1. **Production data never resets.** `db:reset:dev` is for DEV only. PROD uses `db:migrate:deploy` + backfill scripts.
2. **System / Editorial / Content are separate layers.** Each has different lifecycle rules.
3. **Seed is for system data only.** Demo/content data lives in `scripts/dev/seed-demo-data.ts`.
4. **No hardcoded domain truth in frontend.** Reference data comes from DB/API. Frontend constants are presentational fallbacks only.
5. **System entities cannot be deleted.** `isSystem = true` entities are protected at the API layer.
6. **Schema evolution = Prisma migrations.** Never edit the DB schema manually.
7. **Data evolution = backfill scripts.** One-time scripts in `scripts/data-migrations/`.
8. **Archive preferred over hard delete** for editorial taxonomy.

---

## Entity Classification

### SYSTEM
Seeded by `prisma/seed.ts`. Protected from deletion. `isSystem = true`.

| Entity | Key field | Notes |
|--------|-----------|-------|
| `SignalDefinition` | `slug` | tempo, energy, age |
| `SignalOption` | `definitionId + value` | Protected via parent signal |
| `FilterDefinition` | `slug` | when, age |
| `FilterOption` | `filterId + value` | |
| `City` | `slug` | minsk and future cities |
| `District` | `cityId + name` | Seeded per city |

### EDITORIAL
Managed via admin UI. Prefer archive (`archivedAt`) over hard delete.

| Entity | Archive mechanism |
|--------|------------------|
| `EventCategory` | `archivedAt DateTime?` |
| `DiscoveryTaxonomyEntry` | `archivedAt DateTime?` |
| `MetroStation` | Hard delete allowed (geo data) |

### CONTENT
Created by users/businesses. Never seeded. Never mass-deleted.

`Activity`, `Place`, `Offer`, `Route`, `Article`, `User`, `Idea`, `PlanItem`, `Business`, etc.

---

## Seed Scripts

```bash
pnpm db:seed:system   # System data only — safe for all envs
pnpm db:seed:demo     # Demo content — DEV/STAGING only
```

---

## Database Scripts

```bash
pnpm db:migrate:dev      # Dev: create + apply migration
pnpm db:migrate:deploy   # Prod: apply existing migrations only
pnpm db:reset:dev        # DEV ONLY: full reset + re-seed
pnpm db:seed:system      # Idempotent system seed
pnpm db:seed:demo        # Demo data (dev/staging)
```

---

## Environment Policy

| Operation | DEV | STAGING | PROD |
|-----------|-----|---------|------|
| `db:reset:dev` | ✅ | ⚠️ rarely | ❌ never |
| `db:migrate:dev` | ✅ | ❌ | ❌ |
| `db:migrate:deploy` | ✅ | ✅ | ✅ |
| `db:seed:system` | ✅ | ✅ | ✅ |
| `db:seed:demo` | ✅ | ✅ | ❌ never |
| Backfill scripts | ✅ | ✅ | ✅ planned |

---

## System Entity Protection

API routes check `isSystem` before delete/key-change operations via:

```ts
import { assertNotSystemDelete, assertNotSystemKeyChange } from "@/lib/data-policy/systemEntityGuard";
```

Attempting to delete a system entity returns HTTP 403.

---

## Hardcoded Domain Constants (TODO)

The following frontend constants are presentational fallbacks. The canonical source of truth is the DB:

- `src/features/filters/age/ageGroups.ts` — `AGE_GROUPS` → should eventually load from `SignalDefinition[slug=age]`
- `src/lib/business/eventFormatSignals.ts` — `EVENT_FORMAT_OPTIONS` → should load from signals API
- `src/lib/config/ages.ts` — age range config → should align with signal options

These are marked with `// TODO: replace with DB/API source` comments and are safe as-is for MVP.
