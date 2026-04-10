# Place URL Check Guide

Руководство по проверке и управлению URL мест.

## Быстрая проверка

### 1. Проверить конкретное место

По ID:
```bash
npx tsx scripts/check-place-url.ts cmmj9eggc0009wsvnpqrmilie
```

По slug:
```bash
npx tsx scripts/check-place-url.ts pugovka
```

Без параметров (покажет первое опубликованное место):
```bash
npx tsx scripts/check-place-url.ts
```

**Что показывает:**
- Название и ID места
- Текущий slug и URL
- Историю изменений slug (если есть)
- Дубликаты с таким же названием в городе

### 2. Список всех мест с URL

```bash
npx tsx scripts/list-place-urls.ts
```

**Что показывает:**
- Все опубликованные места
- Их URL (если slug назначен)
- Места без slug
- Сводку по городам

### 3. Назначить slug конкретному месту

```bash
npx tsx scripts/data-migrations/assign-slug-to-place.ts <place-id>
```

**Что делает:**
- Генерирует slug для места
- Сохраняет старый slug в историю (если был)
- Пересчитывает slug для дублей (если нужно)

### 4. Назначить slug всем местам (backfill)

```bash
npx tsx scripts/data-migrations/backfill-place-slugs-v2.ts
```

**Что делает:**
- Находит все опубликованные места без slug
- Назначает slug каждому
- Обрабатывает дубликаты автоматически

## Примеры вывода

### Место с уникальным названием

```
📍 Place Information:
   Title: Пуговка
   ID: cmmj9eggc0009wsvnpqrmilie
   Status: PUBLISHED
   City: Минск
   Address: Ратомская 7, Минск

✅ Slug assigned:
   Slug: pugovka
   URL: http://localhost:3000/places/pugovka
```

### Место с дубликатами

```
📍 Place Information:
   Title: Пуговка
   ID: xxx
   Status: PUBLISHED
   City: Минск
   Address: Восточная 12, Минск

✅ Slug assigned:
   Slug: pugovka-vostochnaya-12
   URL: http://localhost:3000/places/pugovka-vostochnaya-12

⚠️  Found 1 other place(s) with same name in Минск:
   - Пуговка
     Slug: pugovka-ratomskaya-7
     Address: Ратомская 7, Минск

💡 Places with duplicate names should have address-based slugs
   Example: pugovka-ratomskaya-7, pugovka-vostochnaya-12
```

### Место со старыми slug (история)

```
✅ Slug assigned:
   Slug: pugovka-ratomskaya-7
   URL: http://localhost:3000/places/pugovka-ratomskaya-7

📜 Slug History (1 old slugs):
   - pugovka (09.03.2026)
     → redirects to: /places/pugovka-ratomskaya-7
```

## Проверка в браузере

1. Запустите dev сервер:
```bash
npm run dev
```

2. Откройте URL места:
```
http://localhost:3000/places/pugovka
```

3. Проверьте редирект со старого slug (если есть):
```
http://localhost:3000/places/pugovka
→ должен редиректить на
http://localhost:3000/places/pugovka-ratomskaya-7
```

## Типичные сценарии

### Сценарий 1: Проверить URL нового места

```bash
# 1. Найти ID места в админке или базе
# 2. Проверить URL
npx tsx scripts/check-place-url.ts <place-id>

# 3. Если slug не назначен, назначить
npx tsx scripts/data-migrations/assign-slug-to-place.ts <place-id>

# 4. Открыть в браузере
# http://localhost:3000/places/<slug>
```

### Сценарий 2: Проверить все места

```bash
# Показать список всех мест с URL
npx tsx scripts/list-place-urls.ts

# Если есть места без slug, назначить всем
npx tsx scripts/data-migrations/backfill-place-slugs-v2.ts
```

### Сценарий 3: Проверить дубликаты

```bash
# Проверить конкретное место
npx tsx scripts/check-place-url.ts pugovka

# Скрипт покажет все дубликаты в том же городе
# и их slug
```

### Сценарий 4: Проверить редирект

```bash
# 1. Проверить историю slug
npx tsx scripts/check-place-url.ts <place-id>

# 2. Если есть старые slug, проверить в браузере
# Старый URL должен редиректить на новый
```

## Troubleshooting

### Место не открывается по URL

1. Проверьте что место опубликовано:
```bash
npx tsx scripts/check-place-url.ts <place-id>
# Status должен быть PUBLISHED
```

2. Проверьте что slug назначен:
```bash
npx tsx scripts/check-place-url.ts <place-id>
# Должен показать "✅ Slug assigned"
```

3. Если slug не назначен:
```bash
npx tsx scripts/data-migrations/assign-slug-to-place.ts <place-id>
```

### Slug не генерируется

1. Проверьте что место опубликовано (status = PUBLISHED)
2. Проверьте что есть название (title)
3. Проверьте что есть город (cityId)

### Дубликаты имеют одинаковые slug

Это не должно происходить. Если произошло:

1. Запустите пересчет:
```bash
npx tsx scripts/data-migrations/backfill-place-slugs-v2.ts
```

2. Проверьте результат:
```bash
npx tsx scripts/list-place-urls.ts
```

## Полезные команды

```bash
# Проверить первое место
npx tsx scripts/check-place-url.ts

# Список всех мест
npx tsx scripts/list-place-urls.ts

# Назначить slug одному месту
npx tsx scripts/data-migrations/assign-slug-to-place.ts <place-id>

# Назначить slug всем местам
npx tsx scripts/data-migrations/backfill-place-slugs-v2.ts

# Тест slug-логики
npx tsx scripts/test-place-slug-logic.ts
```

## Автоматическое назначение

Slug назначается автоматически когда:
- Место публикуется через модерацию (PENDING → PUBLISHED)
- Админ одобряет место

Не нужно назначать slug вручную для новых мест!

## Формат slug

- Уникальное название: `pugovka`
- Дубликаты: `pugovka-ratomskaya-7`, `pugovka-vostochnaya-12`
- Fallback: `pugovka-2`, `pugovka-3` (только если адрес недоступен)

## SEO

- Старые slug сохраняются в историю
- Редиректы постоянные (301)
- Поисковики видят новый URL
- Старые ссылки не ломаются
