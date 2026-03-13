# Media Editing Complete

## Реализованные функции

### 1. Исправлено отображение расширений файлов

Создан helper: `src/lib/media/resolveDisplayFilename.ts`

**Логика:**
- Проверяет, есть ли в filename неправильное расширение (.blob, .tmp)
- Если есть, заменяет на правильное из metadata (extension или mimeType)
- Mapping: image/webp → webp, image/jpeg → jpg, image/png → png и т.д.

**Результат:**
- До: `1773167003936-gjc7nhipxyj.blob`
- После: `1773167003936-gjc7nhipxyj.webp`

**Важно:** storageKey и publicUrl НЕ меняются - это только display logic.

### 2. Улучшено отображение в списке медиатеки

`src/app/admin/media/page.tsx`:
- Показывает display filename (с правильным расширением)
- Если originalName отличается, показывает его второй строкой
- Чистый, понятный формат

### 3. Добавлено редактирование filename и метаданных

Создан компонент: `src/components/admin/media/MediaMetadataEditor.tsx`

**Функции:**
- Редактирование имени файла (без расширения)
- Редактирование alt текста
- Редактирование title
- Редактирование caption
- Inline editing без перезагрузки страницы
- Optimistic UI с кнопками "Сохранить" / "Отмена"

**Правила:**
- Расширение менять нельзя (защищено)
- Можно менять только часть имени до расширения
- Валидация на длину и безопасность

### 4. API для обновления

Обновлен endpoint: `PATCH /api/admin/media/[id]`

**Поддерживает обновление:**
- filename
- alt
- title
- caption

**Валидация:**
- Максимальная длина filename: 255 символов
- Запрещены path traversal символы (../, /)
- Extension не меняется автоматически

### 5. Обновлен service layer

`src/server/services/media/media.service.ts`:
- Добавлен filename в UpdateMediaMetadataInput
- Добавлена валидация filename
- Безопасное обновление с проверками

## Файлы изменены

1. `src/lib/media/resolveDisplayFilename.ts` (новый)
   - Helper для отображения правильного имени файла

2. `src/components/admin/media/MediaMetadataEditor.tsx` (новый)
   - Client component для редактирования
   - Inline editing с optimistic UI

3. `src/app/admin/media/[id]/page.tsx`
   - Использует resolveDisplayFilename
   - Добавлена кнопка "Редактировать"
   - Показывает display filename в заголовке и в блоке информации

4. `src/app/admin/media/page.tsx`
   - Использует resolveDisplayFilename в списке
   - Показывает originalName второй строкой (если отличается)

5. `src/server/services/media/media.service.ts`
   - Добавлен filename в UpdateMediaMetadataInput
   - Добавлена валидация

6. `src/app/api/admin/media/[id]/route.ts`
   - PATCH endpoint поддерживает filename

## Что НЕ изменено

✅ storageKey - остался без изменений
✅ publicUrl - остался без изменений
✅ Физические файлы - не переименовываются
✅ Существующие ссылки - работают как раньше
✅ Upload flow - не затронут

## Тестирование

Создан скрипт: `scripts/test-media-editing.ts`

```bash
npx tsx scripts/test-media-editing.ts
```

**Результат теста:**
- До: `1773167003936-gjc7nhipxyj.blob`
- После: `1773167003936-gjc7nhipxyj.webp`

## Использование

### В списке медиатеки:
- Автоматически показывает правильные расширения
- Оригинальное имя показывается второй строкой

### На странице детали:
1. Нажать кнопку "Редактировать"
2. Изменить имя файла (без расширения)
3. Добавить/изменить alt, title, caption
4. Нажать "Сохранить"
5. Страница перезагрузится с новыми данными

### Пример редактирования:
- Старое имя: `1773167003936-gjc7nhipxyj.webp`
- Новое имя: `pugovka-playroom.webp`
- Alt: "Игровая комната Пуговка"
- Title: "Пуговка - детская игровая"
- Caption: "Фото игровой комнаты"

## Результат

✅ Правильные расширения вместо .blob
✅ Редактирование filename
✅ Редактирование метаданных (alt, title, caption)
✅ Чистый UI без технического мусора
✅ Безопасность и валидация
✅ Не сломаны существующие ссылки
