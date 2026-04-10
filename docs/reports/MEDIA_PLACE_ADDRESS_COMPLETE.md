# Media Metadata: PLACE Address Enhancement — Complete

## Что сделано

Улучшена автогенерация метаданных для изображений PLACE: добавлен короткий адрес места в auto-generated metadata для лучшего SEO и контекста.

## Изменения

### 1. Обновлен `formatShortAddress` helper
**Файл:** `src/lib/media/formatShortAddress.ts`

Логика:
- Если `shortAddress` есть — использовать его (он уже содержит город)
- Если только `cityName` — вернуть город
- Если ничего нет — вернуть `null`

Примеры:
- `"Ратомская 7, Минск"` (из shortAddress)
- `"Минск"` (только город)
- `null` (нет данных)

### 2. Расширен `MediaMetadataContext`
**Файл:** `src/lib/media/generateMediaMetadata.ts`

Добавлено поле:
```typescript
placeAddress?: PlaceAddressData | null;
```

Содержит:
- `cityName` — название города
- `shortAddress` — короткий адрес места

### 3. Обновлена генерация для PLACE
**Файл:** `src/lib/media/generateMediaMetadata.ts`

#### PLACE / logo
Адрес НЕ используется (логотип не привязан к адресу):
```
title: "Логотип Пуговка1"
alt: "Логотип места Пуговка1"
caption: "Логотип Пуговка1"
```

#### PLACE / cover
Если адрес есть:
```
title: "Фото места Пуговка1 — Минск"
alt: "Фотография места Пуговка1, Ратомская 7, Минск"
caption: "Изображение места Пуговка1, Ратомская 7, Минск"
```

Если адреса нет:
```
title: "Пуговка1 — обложка"
alt: "Обложка места Пуговка1"
caption: "Изображение места Пуговка1"
```

#### PLACE / gallery
Если адрес есть:
```
title: "Фото места Пуговка1 — Минск"
alt: "Фотография места Пуговка1, Ратомская 7, Минск"
caption: "Фотогалерея места Пуговка1, Ратомская 7, Минск"
```

Если адреса нет:
```
title: "Пуговка1 — фото"
alt: "Фото места Пуговка1"
caption: "Фотография места Пуговка1"
```

### 4. Обновлен `getMediaUsageContext`
**Файл:** `src/lib/media/getMediaUsageContext.ts`

Для PLACE теперь подтягивается:
- `place.title`
- `place.city.name`
- `place.shortAddress`

Данные передаются в `placeAddress` для генерации metadata.

## Принципы

1. **Роли полей:**
   - `title` — короткий и чистый (только город)
   - `alt` — более описательный (полный адрес)
   - `caption` — самый полный (полный адрес)

2. **Graceful degradation:**
   - Если адреса нет — используются базовые шаблоны
   - Нет кривых строк вида "Пуговка, , ,"

3. **Приоритеты не изменились:**
   - Manual metadata > Auto-generated > Fallback

4. **Не ломает существующее:**
   - Filename не меняется
   - StorageKey не меняется
   - Ручные metadata не перезаписываются

## Тестирование

### Тестовый скрипт
```bash
npx tsx scripts/manual-tests/test-place-address-metadata.ts
```

Проверяет:
- Logo (без адреса)
- Cover (с адресом в alt/caption)
- Gallery (с адресом в alt/caption)

### Результат теста
```
📍 Test Place:
  Title: Пуговка1
  City: Минск
  Short Address: Ратомская 7, Минск

--- Testing field: logo ---
Title: Логотип Пуговка1
Alt: Логотип места Пуговка1
Caption: Логотип Пуговка1

--- Testing field: cover ---
Title: Фото места Пуговка1 — Минск
Alt: Фотография места Пуговка1, Ратомская 7, Минск
Caption: Изображение места Пуговка1, Ратомская 7, Минск

--- Testing field: gallery ---
Title: Фото места Пуговка1 — Минск
Alt: Фотография места Пуговка1, Ратомская 7, Минск
Caption: Фотогалерея места Пуговка1, Ратомская 7, Минск
```

## Как это работает в UI

### Detail Page (`/admin/media/[id]`)
В блоке "Метаданные" показываются:
- Auto-generated значения с бейджем "Авто" (синий)
- Ручные значения с бейджем "Вручную" (зеленый)

Кнопка "Заполнить автоматически" теперь использует новую логику с адресом.

### List Page (`/admin/media`)
Основной текст использует `displayTitle`:
- Для PLACE с адресом: "Фото места Пуговка1 — Минск"
- Более осмысленно, чем техническое имя файла

## Файлы

### Изменены
- `src/lib/media/generateMediaMetadata.ts` — обновлены шаблоны PLACE
- `src/lib/media/getMediaUsageContext.ts` — подтягивается адрес
- `src/lib/media/formatShortAddress.ts` — логика форматирования адреса

### Добавлены
- `scripts/manual-tests/test-place-address-metadata.ts` — тестовый скрипт

## Что дальше

Система готова к использованию:
1. При загрузке изображений для PLACE автоматически генерируются metadata с адресом
2. Редактор видит осмысленные значения
3. Редактор может изменить их вручную
4. SEO улучшается за счет геоконтекста

---

**Статус:** ✅ Complete  
**Дата:** 2026-03-13
