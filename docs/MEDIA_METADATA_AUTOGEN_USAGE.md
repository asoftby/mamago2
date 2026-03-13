# Media Metadata Auto-generation Usage Guide

## Обзор

Система автоматически генерирует метаданные (title, alt, caption) для изображений на основе контекста их использования.

## Приоритеты

1. **Ручные значения** - если редактор заполнил вручную
2. **Автогенерация** - если есть usage context
3. **Fallback** - filename или пустая строка

## Как это работает

### В админке медиатеки

При просмотре `/admin/media/[id]`:
- Если alt/title/caption пустые, показываются автогенерированные значения
- Метка "(автогенерация)" указывает на автоматические значения
- При редактировании автогенерированные значения показываются как placeholders

### В коде приложения

Для компонентов, которые отображают изображения:

```typescript
import { getEffectiveAlt } from "@/lib/media/useMediaMetadata";

// Пример 1: С контекстом
const alt = getEffectiveAlt(
  media.alt,
  {
    entityType: "PLACE",
    entityTitle: place.title,
    field: "cover",
  }
);

// Пример 2: Без контекста (fallback)
const alt = getEffectiveAlt(media.alt, undefined, "Фото места");

// Использование
<img src={url} alt={alt} />
```

## Примеры генерации

### PLACE

#### Logo:
- title: "Пуговка - логотип"
- alt: "Логотип Пуговка"
- caption: "Логотип места Пуговка"

#### Cover:
- title: "Пуговка - обложка"
- alt: "Обложка места Пуговка"
- caption: "Главное изображение места Пуговка"

#### Gallery:
- title: "Пуговка - фото"
- alt: "Фотография места Пуговка"
- caption: "Фото из галереи места Пуговка"

### EVENT

#### Cover:
- title: "Мастер-класс по рисованию - обложка события"
- alt: "Обложка события Мастер-класс по рисованию"
- caption: "Главное изображение события Мастер-класс по рисованию"

### OFFER

#### Cover:
- title: "Скидка 20% - обложка предложения"
- alt: "Обложка предложения Скидка 20%"
- caption: "Главное изображение предложения Скидка 20%"

### USER

#### Avatar:
- title: "Иван Иванов - аватар"
- alt: "Аватар пользователя Иван Иванов"
- caption: "Фото профиля Иван Иванов"

## Интеграция в существующий код

### Шаг 1: Импортировать helper
```typescript
import { getEffectiveAlt } from "@/lib/media/useMediaMetadata";
```

### Шаг 2: Использовать вместо прямого media.alt
```typescript
// Было:
<img src={media.publicUrl} alt={media.alt || ""} />

// Стало:
const alt = getEffectiveAlt(media.alt, {
  entityType: "PLACE",
  entityTitle: place.title,
  field: "cover",
});
<img src={media.publicUrl} alt={alt} />
```

### Шаг 3: Для компонентов без контекста
```typescript
// Если контекст недоступен, использовать fallback
const alt = getEffectiveAlt(media.alt, undefined, place.title);
<img src={media.publicUrl} alt={alt} />
```

## Где применять

### Высокий приоритет (SEO + Accessibility):
- PlaceCard - обложки мест
- EventCard - обложки событий
- OfferCard - обложки предложений
- Place detail page - галерея и логотип
- Event detail page - обложка

### Средний приоритет:
- Admin moderation views
- Business dashboard
- User profiles

### Низкий приоритет:
- Thumbnails в списках
- Preview в админке
- Временные изображения

## Преимущества

✅ **SEO** - правильные alt теги для поисковых систем
✅ **Accessibility** - screen readers получают осмысленные описания
✅ **UX** - редакторам не нужно заполнять вручную
✅ **Гибкость** - можно переопределить вручную
✅ **Масштабируемость** - легко добавить новые типы сущностей

## Ограничения

- Автогенерация работает только если есть MediaUsage
- Для orphaned файлов используется fallback на filename
- Качество автогенерации зависит от качества названий сущностей
- Ручное редактирование всегда имеет приоритет

## Тестирование

```bash
# Тест автогенерации
npx tsx scripts/test-media-autogen.ts

# Проверка в UI
1. Открыть /admin/media/[id]
2. Проверить блок "Метаданные"
3. Увидеть автогенерированные значения с меткой "(автогенерация)"
4. Нажать "Редактировать"
5. Увидеть placeholders с автогенерацией
6. Заполнить вручную - перезапишет автогенерацию
```

## Расширение системы

Для добавления нового типа сущности:

1. Добавить в `generateMediaMetadata.ts`:
```typescript
case "NEW_TYPE":
  return generateNewTypeMetadata(entityTitle, field, fieldLabel);
```

2. Добавить функцию генерации:
```typescript
function generateNewTypeMetadata(...) {
  return {
    title: `${title} - ...`,
    alt: `...`,
    caption: `...`,
  };
}
```

3. Добавить в `getMediaUsageContext.ts`:
```typescript
case "NEW_TYPE": {
  const entity = await prisma.newType.findUnique({
    where: { id: entityId },
    select: { title: true },
  });
  return entity?.title || null;
}
```
