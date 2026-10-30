# КРАТКАЯ СВОДКА: УПРОЩЕНИЕ OFFER WIZARD

**Дата:** 5 мая 2026  
**Полный план:** `OFFER_WIZARD_SIMPLIFICATION_PLAN.md` (1329 строк)

---

## ТЕКУЩАЯ ПРОБЛЕМА

**Сейчас:** 8 шагов, 15-20 обязательных полей, 10-15 минут  
**Цель:** 5 шагов, 10-12 обязательных полей, 2-3 минуты

---

## НОВЫЙ MVP WIZARD (5 ШАГОВ)

### Шаг 1: Что предлагаете?
- `offerKind`: course | birthday | service
- 3 большие карточки с иконками
- **Время:** 10 секунд

### Шаг 2: Основная информация
- `title` (обязательно)
- `description` (обязательно, без ограничения символов)
- `placeId` (обязательно)
- Hint: "Категория наследуется от места"
- **Время:** 1-2 минуты

### Шаг 3: Для кого и как
- `ageMinMonths / ageMaxMonths` (обязательно)
- **Signals (обязательные):**
  - Activity: educational, creative, active, calm, entertainment, social, food
  - Format: indoor, outdoor, online, hybrid
  - Participation: individual, group, family
- **Signals (опциональные, collapsed):**
  - Intention: family-time, active-time, explore, relax
  - Features: free, paid, booking-required
- Auto-suggestions по offerKind
- **Время:** 1 минута

### Шаг 4: Цена и запись
- `priceFrom` (обязательно)
- `priceText` (опционально, collapsed)
- `ctaType` (обязательно, auto-suggested)
- `ctaPhone / ctaLink` (pre-filled из Place/Business)
- **Время:** 30 секунд

### Шаг 5: Публикация
- `coverImage` (обязательно)
- `gallery` (опционально, collapsed)
- Preview карточки оффера
- Actions: "Сохранить черновик" / "Отправить на модерацию"
- **Время:** 1 минута

---

## ЧТО УБРАЛИ

❌ **Избыточные поля:**
- serviceType (9 вариантов) → в description
- locationType → в description
- durationType → в description
- campSessions → для MVP не нужно
- classDuration, classGroupSize, classFormat → в description
- partyProgram, partyDuration, partyChildrenCount, partyIncluded → в description
- serviceDescription, serviceDuration, serviceDeliveryArea → в description
- pricingOptions (multiple pricing) → для MVP не нужно
- socialLinks → редко используется
- bookingSettings → слишком сложно для MVP

❌ **Избыточные шаги:**
- Шаг 4: Формат и условия → всё в description
- Шаг 6: Контакты → phone/website в Step 4 (pre-filled)

---

## КЛЮЧЕВЫЕ УЛУЧШЕНИЯ

✅ **Auto-suggestions:**
- ctaType по offerKind
- activity signals по offerKind
- phone/website из Place/Business

✅ **Pre-filled значения:**
- phone из Place или Business
- website из Place или Business
- Hint: "Телефон из профиля места"

✅ **Collapsed optional:**
- priceText
- gallery
- intention signals
- features signals

✅ **Visual helpers:**
- Иконки для offerKind
- Chips для signals
- Preview карточки оффера
- Hint о категории Place

---

## ОБЯЗАТЕЛЬНЫЕ ПОЛЯ (ДЛЯ SUBMIT)

```typescript
const REQUIRED = {
  offerKind: true,
  title: true,
  description: true,
  placeId: true,
  ageMinMonths: true,
  ageMaxMonths: true,
  activitySignals: { min: 1, max: 3 },
  formatSignals: { min: 1, max: 2 },
  participationSignals: { exactly: 1 },
  priceFrom: true,
  ctaType: true,
  ctaPhone_or_ctaLink: true, // зависит от ctaType
  coverImage: true,
};
```

---

## ПЛАН РЕАЛИЗАЦИИ

**Этап 1:** Подготовка (1 день)
- Обновить типы
- Обновить validation
- Создать helper functions

**Этап 2:** Новые компоненты (2-3 дня)
- OfferKindSelector
- AgeRangePicker
- SignalChipSelector
- OfferPreviewCard

**Этап 3:** Обновить шаги (3-4 дня)
- Step1Type (новый)
- Step2Information (обновить)
- Step3Signals (новый)
- Step4PriceAndCTA (новый)
- Step5Publication (обновить)

**Этап 4:** API mappers (1 день)
- buildOfferCreatePayload
- buildOfferUpdatePayload
- mapOfferToFormData

**Этап 5:** Конфигурация (1 день)
- Обновить offerWizardSteps.config.tsx

**Этап 6:** Тестирование (2 дня)
- Unit tests
- Integration tests
- E2E tests

**Этап 7:** Миграция (1 день)
- Migrate existing offers

**ИТОГО:** 11-13 дней (2-2.5 недели)

---

## РЕЗУЛЬТАТ

**До:**
- ❌ 8 шагов
- ❌ 15-20 обязательных полей
- ❌ 10-15 минут

**После:**
- ✅ 5 шагов
- ✅ 10-12 обязательных полей
- ✅ 2-3 минуты

**Упрощение:** 60% меньше времени, 40% меньше полей

---

**Полный план:** `OFFER_WIZARD_SIMPLIFICATION_PLAN.md`

