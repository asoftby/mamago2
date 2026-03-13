# Media Metadata Editor: Premium Layout — Complete

## Что сделано

Переработан экран редактирования метаданных медиафайла в премиальный и профессиональный editor layout в стиле clean admin UI.

## Изменения

### 1. Новый компонент `MediaMetadataEditorLayout`
**Файл:** `src/components/admin/media/MediaMetadataEditorLayout.tsx`

Полностью новый компонент с премиальным дизайном:

#### Структура (2 колонки):
- **Левая колонка (55-60%):**
  - Preview изображения в красивой card с rounded-2xl
  - Aspect ratio 4:3 для единообразия
  - Soft background (gray-50)
  - Info card под preview:
    - Иконка типа файла
    - Filename
    - MIME type + размер
    - Размеры (если есть)
    - Источник метаданных (entityType + entityTitle)

- **Правая колонка (40-45%):**
  - Eyebrow: "SEO / Метаданные"
  - Title: "Редактирование метаданных"
  - Subtitle с инструкцией
  - Кнопка "Заполнить автоматически" (secondary, с Sparkles icon)
  - Поля формы с badges статуса
  - Информационный баннер (compact, muted blue)
  - Кнопки действий (Сохранить / Отмена)

#### Режимы:
1. **View Mode:**
   - Показывает текущие значения в read-only полях
   - Badges со статусом (Авто/Вручную/Fallback)
   - Кнопка "Редактировать метаданные"

2. **Edit Mode:**
   - Полноценная форма редактирования
   - Placeholders с автогенерацией
   - Hints под полями
   - Кнопка автозаполнения
   - Сохранить / Отмена

### 2. Обновлена detail page
**Файл:** `src/app/admin/media/[id]/page.tsx`

- Заменена старая секция метаданных на новый `MediaMetadataEditorLayout`
- Удалена старая 3-колоночная сетка с preview
- Preview теперь интегрирован в editor layout
- Секции "Действия" и "Информация о файле" перенесены ниже

### 3. Визуальный стиль

#### Цвета и spacing:
- `rounded-2xl` для всех карточек
- `border-gray-200` для мягких границ
- `bg-blue-50` для информационных баннеров
- `gap-8` между колонками
- Vertical rhythm с `space-y-6`, `space-y-5`, `space-y-4`

#### Типографика:
- Eyebrow: `text-xs font-semibold text-blue-600 uppercase tracking-wider`
- Title: `text-xl font-semibold text-gray-900`
- Subtitle: `text-sm text-gray-600`
- Labels: `text-sm font-medium text-gray-700`
- Hints: `text-xs text-gray-500`

#### Поля формы:
- `px-4 py-3` для комфортной высоты
- `rounded-xl` для современного вида
- `focus:ring-2 focus:ring-blue-500` для accessibility
- `transition-shadow` для плавности

#### Кнопки:
- Primary: `bg-blue-600 hover:bg-blue-700`
- Secondary: `bg-blue-50 border-blue-200 hover:bg-blue-100`
- Ghost: `bg-white border-gray-300 hover:bg-gray-50`
- Все с `rounded-xl` и transitions

### 4. UX улучшения

#### Связь изображения и метаданных:
- Preview и форма находятся рядом
- Визуально понятно что редактируется
- Источник метаданных показан в info card

#### Статус полей:
- Badges показывают источник каждого поля
- "Авто" (синий) — автогенерация
- "Вручную" (зеленый) — ручной ввод
- "Fallback" (серый) — fallback значение

#### Автогенерация:
- Кнопка "Заполнить автоматически" с Sparkles icon
- Placeholders показывают что будет подставлено
- Hints под полями с preview автогенерации
- Информационный баннер объясняет источник

#### Responsive:
- На desktop: 2 колонки side-by-side
- На mobile: стек (колонки друг под другом)
- Grid с `lg:grid-cols-[1.2fr_1fr]` для оптимального соотношения

### 5. Сохранена вся логика

Не сломано:
- ✅ Автогенерация метаданных
- ✅ Приоритеты (manual > auto > fallback)
- ✅ Save/Cancel функциональность
- ✅ Reload после сохранения
- ✅ Error handling
- ✅ Loading states
- ✅ Usage context display

Изменен только:
- Layout и presentation layer
- Visual hierarchy
- Spacing и typography
- Component structure

## Результат

Экран редактирования метаданных теперь:
- ✅ Выглядит премиально и профессионально
- ✅ Нет ощущения пустоты
- ✅ Четкая иерархия информации
- ✅ Понятная связь между preview и полями
- ✅ Современный clean admin UI стиль
- ✅ Хороший vertical rhythm
- ✅ Responsive на всех экранах
- ✅ Accessibility (focus states, transitions)

## Файлы

### Добавлены:
- `src/components/admin/media/MediaMetadataEditorLayout.tsx` — новый premium editor

### Изменены:
- `src/app/admin/media/[id]/page.tsx` — использует новый layout

### Не изменены:
- `src/components/admin/media/MediaMetadataEditor.tsx` — старый компонент (можно удалить)
- `src/components/admin/media/MetadataSourceBadge.tsx` — используется в новом layout
- `src/components/admin/media/MediaPreview.tsx` — используется в новом layout

---

**Статус:** ✅ Complete  
**Дата:** 2026-03-13
