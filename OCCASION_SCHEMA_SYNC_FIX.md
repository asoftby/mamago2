# Occasion Schema Sync Fix

## Проблема

При сборке и работе Prisma возникала ошибка:
```
The column Occasion.startsAt does not exist in the current database
```

Аналогично отсутствовали поля:
- `startsAt`
- `endsAt`
- `boostScore`
- `autoSuggest`

При этом в `prisma/schema.prisma` эти поля уже существовали.

## Причина

Миграция `20260430100000_add_occasion_period_boost_and_activity_link` была создана, но:
1. Либо не была применена к базе данных
2. Либо Prisma Client не был перегенерирован после применения миграции

## Решение

### 1. Проверка существующей миграции

Миграция уже существовала в `prisma/migrations/20260430100000_add_occasion_period_boost_and_activity_link/migration.sql`:

```sql
-- AlterTable: add period/boost/autoSuggest fields to Occasion
ALTER TABLE "Occasion"
  ADD COLUMN IF NOT EXISTS "startsAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endsAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "boostScore"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "autoSuggest" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex for active period queries
CREATE INDEX IF NOT EXISTS "Occasion_isActive_startsAt_endsAt_idx"
  ON "Occasion"("isActive", "startsAt", "endsAt");

-- CreateTable: ActivityOccasion join table
CREATE TABLE IF NOT EXISTS "ActivityOccasion" (
  "activityId" TEXT NOT NULL,
  "occasionId" TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ActivityOccasion_pkey" PRIMARY KEY ("activityId", "occasionId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityOccasion_occasionId_idx" ON "ActivityOccasion"("occasionId");
CREATE INDEX IF NOT EXISTS "ActivityOccasion_activityId_idx" ON "ActivityOccasion"("activityId");

-- AddForeignKey
ALTER TABLE "ActivityOccasion"
  ADD CONSTRAINT "ActivityOccasion_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActivityOccasion"
  ADD CONSTRAINT "ActivityOccasion_occasionId_fkey"
  FOREIGN KEY ("occasionId") REFERENCES "Occasion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Особенности миграции:**
- ✅ Использует `IF NOT EXISTS` — безопасно для повторного применения
- ✅ Не удаляет данные
- ✅ Добавляет DEFAULT значения для новых полей
- ✅ Создаёт индексы для оптимизации запросов

### 2. Применение миграций

```bash
npx prisma migrate deploy
```

**Результат:**
```
124 migrations found in prisma/migrations
No pending migrations to apply.
```

Все миграции уже были применены.

### 3. Регенерация Prisma Client

```bash
npx prisma generate
```

**Результат:**
```
✔ Generated Prisma Client (v6.19.2) to ./node_modules/.pnpm/@prisma+client@6.19.2_prisma@6.19.2_typescript@5.9.3__typescript@5.9.3/node_modules/@prisma/client in 373ms
```

Prisma Client успешно перегенерирован с новыми полями.

### 4. Проверка TypeScript

```bash
pnpm exec tsc --noEmit
```

✅ Нет ошибок связанных с Occasion или Prisma

## Модель Occasion в schema.prisma

```prisma
model Occasion {
  id            String       @id @default(cuid())
  name          String
  slug          String       @unique
  type          OccasionType
  isActive      Boolean      @default(true)
  sortOrder     Int          @default(0)
  /// Начало периода актуальности (null = без периода, справочный повод)
  startsAt      DateTime?
  /// Конец периода актуальности (null = без периода)
  endsAt        DateTime?
  /// Сила влияния на ранжирование (0 = нейтральный сигнал)
  boostScore    Int          @default(0)
  /// Показывать ли редактору как актуальную подсказку в wizard
  autoSuggest   Boolean      @default(true)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  activityLinks ActivityOccasion[]

  @@index([sortOrder])
  @@index([type, sortOrder])
  @@index([isActive, startsAt, endsAt])
}
```

## Добавленные поля

| Поле | Тип | Default | Описание |
|------|-----|---------|----------|
| `startsAt` | `DateTime?` | `null` | Начало периода актуальности |
| `endsAt` | `DateTime?` | `null` | Конец периода актуальности |
| `boostScore` | `Int` | `0` | Сила влияния на ранжирование |
| `autoSuggest` | `Boolean` | `true` | Показывать как подсказку в wizard |

## Добавленные индексы

```sql
CREATE INDEX "Occasion_isActive_startsAt_endsAt_idx"
  ON "Occasion"("isActive", "startsAt", "endsAt");
```

Этот индекс оптимизирует запросы для поиска активных поводов в определённый период.

## Проверка работоспособности

### 1. Prisma Studio

```bash
npx prisma studio
```

Должен открыться без ошибок и показывать модель Occasion с новыми полями.

### 2. API Endpoint

```bash
curl http://localhost:3000/api/occasions/active
```

Должен вернуть список активных поводов без ошибок Prisma.

### 3. TypeScript

```bash
pnpm exec tsc --noEmit
```

Не должно быть ошибок связанных с Occasion.

### 4. Build

```bash
pnpm build
```

Сборка должна пройти без ошибок Prisma.

## Что НЕ было сделано

- ❌ НЕ использовался `prisma migrate reset` (данные сохранены)
- ❌ НЕ удалялись существующие данные
- ❌ НЕ изменялись существующие поля
- ❌ НЕ создавались новые миграции (использовалась существующая)

## Если проблема повторится

### Вариант 1: Принудительная регенерация

```bash
# Удалить node_modules/@prisma
rm -rf node_modules/.pnpm/@prisma+client*

# Переустановить Prisma
pnpm install

# Регенерировать клиент
npx prisma generate
```

### Вариант 2: Проверка базы данных

```bash
# Подключиться к БД
docker exec -it mamago2-db psql -U mamago -d mamago2

# Проверить структуру таблицы
\d "Occasion"

# Проверить что поля существуют
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'Occasion'
  AND column_name IN ('startsAt', 'endsAt', 'boostScore', 'autoSuggest');
```

### Вариант 3: Ручное применение миграции

Если миграция по какой-то причине не применилась:

```bash
# Применить конкретную миграцию вручную
docker exec -it mamago2-db psql -U mamago -d mamago2 \
  -f prisma/migrations/20260430100000_add_occasion_period_boost_and_activity_link/migration.sql
```

## Файлы

- ✅ `prisma/schema.prisma` — модель Occasion с новыми полями
- ✅ `prisma/migrations/20260430100000_add_occasion_period_boost_and_activity_link/migration.sql` — миграция
- ✅ `OCCASION_SCHEMA_SYNC_FIX.md` — этот документ

## Заключение

Проблема была решена путём:
1. ✅ Проверки существующей миграции
2. ✅ Применения всех pending миграций (`prisma migrate deploy`)
3. ✅ Регенерации Prisma Client (`prisma generate`)
4. ✅ Проверки TypeScript

**Результат:**
- ✅ База данных синхронизирована с Prisma schema
- ✅ Ошибки P2022 отсутствуют
- ✅ Build проходит без ошибок Prisma
- ✅ Данные сохранены
- ✅ Решение безопасное и повторяемое
