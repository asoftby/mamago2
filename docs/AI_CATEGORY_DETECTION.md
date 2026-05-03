# AI Category Detection для событий

## Обзор

Система автоматического определения категории события с помощью AI (OpenRouter API).

## Как это работает

1. **Парсинг события** → извлекаются данные из источника (название, описание, место, теги и т.д.)
2. **Нормализация** → данные приводятся к единому формату (`NormalizedEventImport`)
3. **AI-анализ** → если категория не определена, AI анализирует контекст и выбирает подходящую категорию
4. **Результат** → категория сохраняется в `aiDetectedCategory` и добавляется в `categoryCandidates`

## Использование

### В normalizer (автоматически)

```typescript
import { normalizeEventPayloadWithAI } from "@/server/modules/import/normalizers/event.normalizer";

// Автоматически использует AI, если categoryCandidates пустой
const result = await normalizeEventPayloadWithAI({
  rawPayload: parsedData,
  sourceSlug: "afisha-by",
  sourceUrl: "https://example.com/event/123",
  externalId: "123",
});

if (result.aiDetectedCategory) {
  console.log("AI определил категорию:", result.aiDetectedCategory.categoryPath);
  console.log("Уверенность:", result.aiDetectedCategory.confidence);
}
```

### Принудительное использование AI

```typescript
// Использовать AI даже если есть categoryCandidates
const result = await normalizeEventPayloadWithAI(
  {
    rawPayload: parsedData,
    sourceSlug: "afisha-by",
    sourceUrl: "https://example.com/event/123",
  },
  { forceAiDetection: true }
);
```

### Прямой вызов AI detection

```typescript
import { detectEventCategory } from "@/lib/ai/detectEventCategory";

const category = await detectEventCategory({
  title: "Концерт группы Би-2",
  description: "Легендарная рок-группа выступит с новой программой",
  venueName: "Минск-Арена",
  categoryCandidates: ["музыка", "концерт"],
});

if (category) {
  console.log("Категория:", category.categoryPath);
  console.log("ID:", category.categoryId);
  console.log("Slug:", category.categorySlug);
  console.log("Уверенность:", category.confidence);
}
```

## Структура результата

```typescript
interface CategoryDetectionResult {
  categoryId: string;              // ID категории (может быть root или subcategory)
  categorySlug: string;            // Slug категории
  categoryNameRu: string;          // Название на русском
  categoryPath: string;            // Полный путь (например: "Концерты -> Рок")
  rootCategoryId: string;          // ID корневой категории
  subcategoryId: string | null;    // ID подкатегории (если выбрана)
  confidence: number;              // Уверенность AI (0-1)
  reason: string;                  // Причина выбора
}
```

## Уровни уверенности

- **0.7+** — высокая уверенность (AI уверен в выборе)
- **0.5-0.7** — средняя уверенность (вероятно правильно)
- **0.4-0.5** — низкая уверенность (требуется проверка)
- **<0.4** — результат не возвращается (слишком низкая уверенность)

## Интеграция с Event Wizard

AI-определённая категория автоматически подставляется в форму создания события:

1. При открытии формы проверяется `normalizedData.aiDetectedCategoryId`
2. Если категория определена с высокой уверенностью (>0.7), она автоматически выбирается
3. Пользователь может изменить категорию вручную

## Конфигурация

Настройки в `.env`:

```bash
# OpenRouter API (используется для AI category detection)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_TEMPERATURE=0.4
OPENROUTER_MAX_TOKENS=900
OPENROUTER_SITE_URL=http://mamago.local:3000
OPENROUTER_APP_NAME=mamaGo 2.0
```

## Примеры работы

### Пример 1: Концерт

**Вход:**
```json
{
  "title": "Концерт группы Би-2",
  "description": "Легендарная рок-группа выступит с новой программой",
  "venueName": "Минск-Арена"
}
```

**Результат:**
```json
{
  "categoryPath": "Концерты -> Рок",
  "confidence": 0.92,
  "reason": "Явно указан концерт рок-группы"
}
```

### Пример 2: Мастер-класс

**Вход:**
```json
{
  "title": "Мастер-класс по рисованию для детей",
  "ageText": "5-10 лет",
  "categoryCandidates": ["творчество", "дети"]
}
```

**Результат:**
```json
{
  "categoryPath": "Мастер-классы -> Творчество",
  "confidence": 0.88,
  "reason": "Мастер-класс по творчеству для детей"
}
```

### Пример 3: Выставка

**Вход:**
```json
{
  "title": "Выставка современного искусства",
  "venueName": "Национальный художественный музей",
  "description": "Представлены работы современных белорусских художников"
}
```

**Результат:**
```json
{
  "categoryPath": "Выставки -> Искусство",
  "confidence": 0.85,
  "reason": "Выставка в музее"
}
```

## Обработка ошибок

AI detection может не сработать в следующих случаях:

1. **Нет API ключа** — `OPENROUTER_API_KEY` не настроен
2. **Недостаточно данных** — нет названия события
3. **Нет активных категорий** — в БД нет категорий с `isActive=true`
4. **Низкая уверенность** — AI не уверен в выборе (<0.4)
5. **Ошибка API** — проблемы с OpenRouter (лимиты, баланс и т.д.)

Во всех случаях функция возвращает `null` и логирует ошибку в консоль.

## Производительность

- **Время выполнения:** ~1-3 секунды на запрос
- **Стоимость:** зависит от модели (gpt-4o-mini ~$0.0001 за запрос)
- **Кэширование:** не реализовано (можно добавить по content hash)
- **Батчинг:** не реализован (можно добавить для массового импорта)

## Будущие улучшения

1. **Кэширование результатов** — по хешу контента события
2. **Батчинг запросов** — для массового импорта
3. **Fallback на rule-based** — если AI недоступен
4. **Обучение на истории** — использовать данные о ручных правках
5. **Мультиязычность** — поддержка английского и других языков

## Отладка

Включить подробное логирование:

```typescript
// В detectEventCategory.ts
console.log("[AI Category Detection] Input:", input);
console.log("[AI Category Detection] Candidates:", candidates.length);
console.log("[AI Category Detection] AI Result:", aiResult);
```

Проверить результат в консоли:

```bash
# В логах сервера
[Event Normalizer] Attempting AI category detection for: Концерт группы Би-2
[AI Category Detection] Input: { title: "Концерт группы Би-2", ... }
[AI Category Detection] AI Result: { categoryId: "...", confidence: 0.92 }
[Event Normalizer] AI detected category: Концерты -> Рок (confidence: 0.92)
```

## См. также

- `src/lib/ai/detectEventCategory.ts` — основная логика AI detection
- `src/server/modules/import/normalizers/event.normalizer.ts` — интеграция в normalizer
- `src/lib/ai/enrichEvent.ts` — существующий AI enrichment (формат, интересы)
- `docs/EVENT_WIZARD_PHASE1_COMPLETE.md` — документация Event Wizard
