# Offer Event Removal Refactor

## Обзор

Выполнен полный рефакторинг Offer Wizard для удаления поддержки EVENT типа и разделения ответственности между Events и Offers в системе mamaGo.

## Новая продуктовая логика

### Events (отдельный Event Wizard):
- Разовые события
- Мероприятия  
- Мастер-классы с датами
- Спектакли
- Афиша

### Offers (обновленный Offer Wizard):
- **COURSE** - Курс / занятия
- **BIRTHDAY** - Детский праздник  
- **SERVICE** - Услуга

## Изменения в файлах

### 1. `src/components/business/wizard/offer/types.ts`
**Удалено:**
- `"event"` из union type `offerKind`
- Все visit/event поля: `visitIncluded`, `visitDuration`, `visitBookingRequired`

**Результат:** Теперь поддерживает только `"course" | "birthday" | "service"`

### 2. `src/components/business/wizard/offer/defaults.ts`
**Удалено:**
- EVENT из `determineIntent()` функции
- EVENT из `suggestCTAType()` функции  
- Дефолтные значения для visit полей

**Обновлено:**
- Логика определения intent теперь только для COURSE/BIRTHDAY/SERVICE
- CTA suggestions адаптированы под новые типы

### 3. `src/components/business/wizard/offer/steps/Step1Type.tsx`
**Удалено:**
- Карточка "Событие или активность"
- Импорт `Calendar` иконки
- EVENT из helper примеров

**Обновлено:**
- Только 3 карточки: Курс/занятия, Детский праздник, Услуга
- Улучшенные описания карточек
- Helper placeholder: "Например: курс, день рождения, торт, аниматор"
- SERVICE UX тексты: "Какая услуга?" и "В определённом месте"

### 4. `src/components/business/wizard/offer/steps/Step4Conditions.tsx`
**Удалено:**
- `renderVisitFields()` функция полностью
- Импорт `Checkbox` компонента
- EVENT условный рендеринг

**Результат:** Теперь рендерит только course/birthday/service поля

### 5. `src/components/business/wizard/offer/validation.ts`
**Удалено:**
- Вся валидация для EVENT/visit полей
- EVENT из completion checks

**Обновлено:**
- Валидация только для COURSE/BIRTHDAY/SERVICE
- Упрощенная логика без EVENT случаев

### 6. `src/components/business/wizard/offer/offerWizardSteps.config.tsx`
**Удалено:**
- EVENT из kindLabels mapping
- EVENT из isComplete логики
- EVENT из getSummary функций
- EVENT из getMissingFields функций

**Обновлено:**
- Конфигурация только для 3 типов
- Упрощенная step логика

## Удаленная EVENT поддержка

### Полностью удалено:
1. **Тип данных:** `"event"` из offerKind union type
2. **UI компоненты:** Карточка "Событие или активность" 
3. **Поля формы:** `visitIncluded`, `visitDuration`, `visitBookingRequired`
4. **Валидация:** Вся логика валидации для EVENT
5. **Конфигурация:** EVENT из всех step configs и mappings
6. **Helper примеры:** "мастер-класс", "мероприятие", "спектакль", "посещение"
7. **Функции:** `renderVisitFields()` в Step4Conditions

### Обновленные тексты:
- **COURSE:** "Регулярные занятия и секции для детей"
- **BIRTHDAY:** "Готовая программа дня рождения или праздник под ключ"  
- **SERVICE:** "Отдельная услуга: торт, декор, фотограф, аниматор и другие услуги"

## Legacy следы EVENT в offer-модели

### ✅ Полностью очищено:
- TypeScript типы
- React компоненты  
- Валидация логика
- Step конфигурация
- UI тексты и примеры
- Helper suggestions

### ⚠️ Требует внимания:
- **Prisma schema:** `OfferKind` enum все еще содержит `EVENT`
- **База данных:** Возможны существующие записи с `kind = EVENT`
- **API endpoints:** Могут принимать EVENT в запросах

## Рекомендации по Prisma migration

### Безопасный подход:
1. **Сначала:** Запретить создание новых offers с `type = EVENT` на уровне API
2. **Затем:** Добавить валидацию на сервере против EVENT
3. **Потом:** Подготовить миграцию для очистки legacy данных
4. **Наконец:** Удалить EVENT из Prisma enum

### Пример серверной валидации:
```typescript
// В API handlers
if (offerData.kind === 'EVENT') {
  throw new Error('EVENT offers are no longer supported. Use Event Wizard instead.');
}
```

## Финальный результат

### ✅ Достигнуто:
- Четкое разделение Events и Offers
- Упрощенный UX без дублирования
- Чистая архитектура без пересечений
- Согласованная типизация
- Улучшенные тексты интерфейса

### 🎯 Offer Wizard теперь:
- Показывает только 3 релевантных типа
- Фокусируется на коммерческих предложениях
- Не пересекается с Event flow
- Имеет четкую продуктовую логику

### 📋 Следующие шаги:
1. Тестирование обновленного UI
2. Серверная валидация против EVENT
3. Планирование Prisma migration
4. Обновление API документации