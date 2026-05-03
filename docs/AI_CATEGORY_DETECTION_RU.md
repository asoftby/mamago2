# Автоматическое определение категории события с помощью AI

## Что реализовано

Система автоматического определения категории события на основе контекста (название, описание, место проведения, теги и т.д.) с использованием AI (OpenRouter API).

## Основные компоненты

### 1. AI Service (`src/lib/ai/detectEventCategory.ts`)

Основной сервис для определения категории:

```typescript
import { detectEventCategory } from "@/lib/ai/detectEventCategory";

const result = await detectEventCategory({
  title: "Концерт группы Би-2",
  description: "Легендарная рок-группа выступит с новой программой",
  venueName: "Минск-Арена",
  categoryCandidates: ["музыка", "концерт"],
});

// result = {
//   categoryId: "...",
//   categorySlug: "concerts-rock",
//   categoryNameRu: "Рок",
//   categoryPath: "Концерты -> Рок",
//   rootCategoryId: "...",
//   subcategoryId: "...",
//   confidence: 0.92,
//   reason: "Явно указан концерт рок-группы"
// }
```

**Возможности:**
- Загружает активные категории из БД
- Строит промпт для AI с контекстом события
- Отправляет запрос в OpenRouter API
- Валидирует ответ AI
- Возвращает категорию с уверенностью (confidence)

### 2. Интеграция в Event Normalizer

Добавлена асинхронная версия нормализатора с AI:

```typescript
import { normalizeEventPayloadWithAI } from "@/server/modules/import/normalizers/event.normalizer";

// Автоматически использует AI, если categoryCandidates пустой
const result = await normalizeEventPayloadWithAI({
  rawPayload: parsedData,
  sourceSlug: "afisha-by",
  sourceUrl: "https://example.com/event/123",
});

if (result.aiDetectedCategory) {
  console.log("AI определил:", result.aiDetectedCategory.categoryPath);
  console.log("Уверенность:", result.aiDetectedCategory.confidence);
}
```

**Логика работы:**
1. Выполняется обычная нормализация
2. Если `categoryCandidates` пустой → запускается AI detection
3. AI анализирует контекст и выбирает категорию
4. Результат добавляется в `aiDetectedCategory`
5. Категория добавляется в `categoryCandidates` для UI

### 3. API Endpoint (`/api/ai/detect-category`)

REST API для тестирования и использования в UI:

```bash
curl -X POST http://localhost:3000/api/ai/detect-category \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Концерт группы Би-2",
    "description": "Легендарная рок-группа",
    "venueName": "Минск-Арена"
  }'
```

**Ответ:**
```json
{
  "success": true,
  "category": {
    "id": "...",
    "slug": "concerts-rock",
    "nameRu": "Рок",
    "path": "Концерты -> Рок",
    "rootCategoryId": "...",
    "subcategoryId": "...",
    "confidence": 0.92,
    "reason": "Явно указан концерт рок-группы"
  },
  "provider": "openrouter"
}
```

### 4. Тестовый скрипт

Скрипт для проверки работы AI detection:

```bash
pnpm tsx scripts/test-ai-category-detection.ts
```

Тестирует 5 сценариев:
- Концерт рок-группы
- Мастер-класс для детей
- Выставка в музее
- Детский спектакль
- Спортивное мероприятие

## Как это работает

### Шаг 1: Сбор контекста

AI анализирует следующие данные:
- **Название события** (обязательно)
- Описание (полное или краткое)
- Место проведения
- Адрес
- Теги из источника
- Возрастные ограничения
- Цена
- Расписание
- Организатор

### Шаг 2: Загрузка категорий

Из БД загружаются все активные категории событий:
- Корневые категории без детей (например: "Фестивали")
- Подкатегории (например: "Концерты -> Рок")
- Для каждой категории извлекаются ключевые слова

### Шаг 3: AI-анализ

AI получает:
- Контекст события
- Список доступных категорий с ключевыми словами
- Примеры правильной классификации

AI возвращает:
- ID выбранной категории
- Уверенность (0-1)
- Причину выбора

### Шаг 4: Валидация

Результат проверяется:
- Категория существует в БД
- Уверенность >= 0.4 (иначе результат отклоняется)
- Формат ответа корректный

## Уровни уверенности

| Confidence | Описание | Действие |
|-----------|----------|----------|
| 0.7 - 1.0 | Высокая уверенность | Автоматически выбирается в UI |
| 0.5 - 0.7 | Средняя уверенность | Предлагается пользователю |
| 0.4 - 0.5 | Низкая уверенность | Показывается как вариант |
| < 0.4 | Слишком низкая | Результат не возвращается |

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
  "venueName": "Национальный художественный музей"
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

## Интеграция с Event Wizard

### Автоматическое заполнение категории

При создании события из импорта:

1. Проверяется `normalizedData.aiDetectedCategoryId`
2. Если категория определена с высокой уверенностью (>0.7):
   - Автоматически выбирается в dropdown "Основная категория"
   - Если есть подкатегория → выбирается и она
3. Пользователь может изменить выбор вручную

### Кнопка "Определить категорию"

В форме создания события можно добавить кнопку:

```typescript
async function handleDetectCategory() {
  const response = await fetch("/api/ai/detect-category", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: formData.title,
      description: formData.description,
      venueName: formData.venueName,
    }),
  });

  const result = await response.json();
  if (result.success) {
    // Установить categoryId в форме
    setFormData({
      ...formData,
      categoryId: result.category.rootCategoryId,
      subcategoryId: result.category.subcategoryId,
    });
  }
}
```

## Конфигурация

### Переменные окружения

В `.env` или `.env.local`:

```bash
# OpenRouter API (обязательно)
OPENROUTER_API_KEY=sk-or-v1-...

# Опционально (есть дефолты)
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_TEMPERATURE=0.4
OPENROUTER_MAX_TOKENS=900
OPENROUTER_SITE_URL=http://mamago.local:3000
OPENROUTER_APP_NAME=mamaGo 2.0
```

### Получение API ключа

1. Зарегистрироваться на https://openrouter.ai/
2. Пополнить баланс ($5-10 хватит надолго)
3. Создать API ключ в https://openrouter.ai/keys
4. Добавить в `.env.local`

## Стоимость и производительность

### Стоимость

- **Модель:** `openai/gpt-4o-mini`
- **Цена:** ~$0.0001 за запрос
- **1000 событий:** ~$0.10
- **10000 событий:** ~$1.00

### Производительность

- **Время:** 1-3 секунды на запрос
- **Timeout:** 20 секунд
- **Параллельность:** можно запускать несколько запросов одновременно

### Оптимизация (будущее)

1. **Кэширование** — по хешу контента события
2. **Батчинг** — обработка нескольких событий за один запрос
3. **Fallback** — rule-based классификация если AI недоступен

## Обработка ошибок

AI detection может не сработать:

| Ошибка | Причина | Решение |
|--------|---------|---------|
| API key not configured | Нет `OPENROUTER_API_KEY` | Добавить в `.env.local` |
| Title is required | Нет названия события | Передать `title` |
| No active categories | Нет категорий в БД | Создать категории в админке |
| Confidence too low | AI не уверен (<0.4) | Добавить больше контекста |
| OpenRouter error | Проблемы с API | Проверить баланс, лимиты |

Во всех случаях функция возвращает `null` и логирует ошибку.

## Логирование

Включено по умолчанию:

```
[Event Normalizer] Attempting AI category detection for: Концерт группы Би-2
[AI Category Detection] Input: { title: "Концерт группы Би-2", ... }
[AI Category Detection] AI Result: { categoryId: "...", confidence: 0.92 }
[Event Normalizer] AI detected category: Концерты -> Рок (confidence: 0.92)
```

## Тестирование

### Запуск тестов

```bash
# Тестовый скрипт
pnpm tsx scripts/test-ai-category-detection.ts

# Через API
curl -X POST http://localhost:3000/api/ai/detect-category \
  -H "Content-Type: application/json" \
  -d '{"title":"Концерт группы Би-2","venueName":"Минск-Арена"}'
```

### Ожидаемый результат

```
🧪 Testing AI Category Detection
================================================================================

📝 Test: Концерт рок-группы
--------------------------------------------------------------------------------
Input:
  Title: Концерт группы Би-2
  Description: Легендарная рок-группа выступит с новой программой...
  Venue: Минск-Арена
  Tags: музыка, концерт

✅ Result:
  Category: Концерты -> Рок
  Slug: concerts-rock
  Confidence: 92.0%
  Reason: Явно указан концерт рок-группы
  Root ID: ...
  Subcategory ID: ...
```

## Следующие шаги

### Для использования в production

1. ✅ Реализован AI service
2. ✅ Интегрирован в normalizer
3. ✅ Создан API endpoint
4. ✅ Написаны тесты
5. ⏳ Интеграция в Event Wizard UI
6. ⏳ Добавить кнопку "Определить категорию" в форму
7. ⏳ Автоматическое заполнение при импорте
8. ⏳ Кэширование результатов
9. ⏳ Батчинг для массового импорта

### Интеграция в UI (TODO)

1. **В форме создания события:**
   - Добавить кнопку "🤖 Определить категорию"
   - При клике → вызов `/api/ai/detect-category`
   - Автоматическое заполнение dropdown

2. **При импорте:**
   - Использовать `normalizeEventPayloadWithAI`
   - Показывать AI-определённую категорию
   - Позволить изменить вручную

3. **В списке импортов:**
   - Показывать badge с confidence
   - Цветовая индикация уверенности
   - Возможность переопределить

## Файлы

- `src/lib/ai/detectEventCategory.ts` — основной AI service
- `src/server/modules/import/normalizers/event.normalizer.ts` — интеграция в normalizer
- `src/server/modules/import/types/index.ts` — типы
- `src/app/api/ai/detect-category/route.ts` — API endpoint
- `scripts/test-ai-category-detection.ts` — тестовый скрипт
- `docs/AI_CATEGORY_DETECTION.md` — документация (EN)
- `docs/AI_CATEGORY_DETECTION_RU.md` — документация (RU)

## Поддержка

При возникновении проблем:

1. Проверить логи в консоли
2. Проверить `OPENROUTER_API_KEY` в `.env.local`
3. Проверить баланс на https://openrouter.ai/
4. Запустить тестовый скрипт
5. Проверить наличие активных категорий в БД
