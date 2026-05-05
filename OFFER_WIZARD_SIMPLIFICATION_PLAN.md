# ПЛАН УПРОЩЕНИЯ OFFER WIZARD

**Дата:** 5 мая 2026  
**Цель:** Сделать создание оффера максимально быстрым (2-3 минуты)  
**Статус:** Готов к реализации

---

## 1. ТЕКУЩАЯ СТРУКТУРА WIZARD

### Шаги (7 + 1 review = 8 шагов)

#### **Шаг 1: Тип предложения**
**Поля:**
- `offerKind`: course | birthday | service (обязательно)
- `durationType`: single | recurring | camp (для course)
- `serviceType`: торт | декор | фотограф | аниматор | шоу | аквагрим | ведущий | мастер_класс_на_выезд | другое (для service)
- `locationType`: client_location | place | remote (для service)
- `intent`: куда_пойти | занятия | день_рождения (auto-determined)

**Проблемы:**
- ❌ Слишком много вложенной логики (if course → durationType, if service → serviceType + locationType)
- ❌ serviceType — 9 вариантов, но wizard не использует их дальше
- ❌ intent определяется автоматически, но не показывается пользователю

---

#### **Шаг 2: Публичная информация**
**Поля:**
- `title`: string (обязательно, min 3 chars)
- `shortDescription`: string (обязательно, min 10 chars, max 120 chars)
- `ageGroups`: string[] (опционально)

**Проблемы:**
- ❌ shortDescription ограничен 120 символами — слишком мало
- ❌ Нет полного description (только short)
- ❌ ageGroups не обязательны, но важны для фильтрации

---

#### **Шаг 3: Медиа**
**Поля:**
- `coverImage`: string (обязательно)
- `gallery`: string[] (опционально)

**Проблемы:**
- ✅ Шаг простой и понятный
- ⚠️ coverImage обязательно — может замедлить создание

---

#### **Шаг 4: Формат и условия**
**Поля (зависят от offerKind):**

**Для course:**
- `classDuration`: string (обязательно)
- `classGroupSize`: string (опционально)
- `classFormat`: trial | course | subscription (обязательно)

**Для camp (durationType = "camp"):**
- `campSessions`: Array<{dateFrom, dateTo}> (обязательно)
- `campPriceText`: string (опционально)

**Для birthday:**
- `partyProgram`: string (обязательно)
- `partyDuration`: string (обязательно)
- `partyChildrenCount`: string (опционально)
- `partyIncluded`: string (опционально)

**Для service:**
- `serviceDescription`: string (обязательно)
- `serviceDuration`: string (опционально)
- `serviceDeliveryArea`: string (опционально)

**Проблемы:**
- ❌ Слишком много условной логики
- ❌ Разные поля для разных типов — сложно поддерживать
- ❌ Многие поля дублируют shortDescription
- ❌ campSessions — сложная структура для MVP

---

#### **Шаг 5: Ценообразование**
**Поля:**
- `pricingMode`: single | multiple (обязательно)
- `singlePrice`: string (для single)
- `singleCurrency`: BYN | USD | EUR (для single)
- `singlePriceLabel`: string (для single, опционально)
- `pricingOptions`: Array<{title, price, oldPrice, description}> (для multiple)

**Проблемы:**
- ❌ pricingMode = multiple — слишком сложно для MVP
- ❌ Большинство офферов имеют одну цену
- ⚠️ singleCurrency — всегда BYN в Беларуси

---

#### **Шаг 6: Контакты**
**Поля:**
- `phone`: string (опционально)
- `website`: string (опционально)
- `socialLinks`: Array<{network, url}> (опционально)

**Проблемы:**
- ❌ Шаг опциональный, но занимает место
- ❌ socialLinks — сложная структура, редко используется
- ⚠️ Контакты можно взять из Place или Business

---

#### **Шаг 7: CTA и публикация**
**Поля:**
- `ctaType`: записаться | забронировать | купить_билет | отправить_заявку | перейти_на_сайт (обязательно)
- `ctaPhone`: string (для записаться/отправить_заявку)
- `ctaLink`: string (для перейти_на_сайт/купить_билет)
- `ctaInstructions`: string (опционально)
- `signalIds`: string[] (опционально)
- `bookingSettings`: {...} (для забронировать, сложная структура)

**Проблемы:**
- ❌ bookingSettings — огромная вложенная структура (mode, selectionType, availableDaysAhead, capacityPerUnit, slotDurationMinutes, weeklyAvailability, excludedDates)
- ❌ Слишком сложно для MVP
- ❌ signalIds показываются в конце, но должны быть раньше
- ⚠️ ctaType можно определить автоматически по offerKind

---

#### **Шаг 8: Проверка (Review)**
**Функция:**
- Показывает summary всех шагов
- Позволяет вернуться к любому шагу
- Кнопка "Отправить на модерацию"

**Проблемы:**
- ✅ Шаг полезный
- ⚠️ Можно упростить UI

---

### ИТОГО: Текущая структура

**Всего шагов:** 8 (7 контентных + 1 review)  
**Обязательных полей:** ~15-20 (зависит от offerKind)  
**Опциональных полей:** ~20-25  
**Условной логики:** Очень много (if offerKind, if durationType, if ctaType)

**Время заполнения:** 10-15 минут (слишком долго!)

---

## 2. ЧТО ЛИШНЕЕ

### 2.1. Избыточные поля

❌ **serviceType** (9 вариантов)
- Не используется в модели Offer
- Не используется в фильтрации
- Можно заменить на description

❌ **locationType** (для service)
- Не используется в модели
- Можно заменить на serviceDeliveryArea

❌ **durationType** (для course)
- Не используется в модели
- Можно заменить на classFormat

❌ **campSessions** (для camp)
- Сложная структура
- Не сохраняется в модели (нет OfferSession)
- Для MVP не нужно

❌ **campPriceText**
- Дублирует singlePriceLabel

❌ **classGroupSize**
- Опционально
- Можно добавить в description

❌ **partyChildrenCount**
- Опционально
- Можно добавить в description

❌ **partyIncluded**
- Опционально
- Можно добавить в description

❌ **serviceDuration**
- Опционально
- Можно добавить в description

❌ **serviceDeliveryArea**
- Опционально
- Можно добавить в description

❌ **singleCurrency**
- Всегда BYN
- Можно hardcode

❌ **singlePriceLabel**
- Опционально
- Редко используется

❌ **pricingOptions** (multiple pricing)
- Слишком сложно для MVP
- Можно добавить позже

❌ **socialLinks**
- Сложная структура
- Редко используется
- Можно взять из Business

❌ **ctaInstructions**
- Опционально
- Можно добавить позже

❌ **bookingSettings**
- Огромная структура
- Слишком сложно для MVP
- Можно добавить позже

---

### 2.2. Избыточные шаги

❌ **Шаг 6: Контакты**
- Весь шаг опциональный
- Контакты можно взять из Place/Business
- Можно объединить с другим шагом

---

### 2.3. Избыточная логика

❌ **Условные поля в Step 4**
- Разные поля для course/birthday/service
- Сложно поддерживать
- Можно упростить до общих полей

❌ **Auto-determined intent**
- Определяется, но не показывается
- Пользователь не понимает, куда попадет оффер

---

## 3. ЧТО ОСТАВИТЬ

### 3.1. Обязательные поля (для MVP)

✅ **offerKind**: course | birthday | service
- Основная классификация
- Определяет тип оффера

✅ **title**: string
- Название оффера
- Обязательно для всех

✅ **description**: string (вместо shortDescription)
- Полное описание
- Без ограничения в 120 символов

✅ **placeId**: string
- Привязка к месту
- Категория наследуется от Place

✅ **ageMinMonths / ageMaxMonths**: number
- Возраст детей
- Важно для фильтрации

✅ **coverImage**: string
- Главное изображение
- Обязательно для публикации

✅ **priceFrom**: number
- Цена "от"
- Обязательно

✅ **ctaType**: записаться | забронировать | купить_билет | отправить_заявку | перейти_на_сайт
- Действие пользователя
- Обязательно

✅ **ctaPhone / ctaLink**: string
- Контакт для CTA
- Зависит от ctaType

✅ **discoverySignalIds**: string[]
- Сигналы для рекомендаций
- Обязательно: activity, format, participation
- Опционально: intention, features

---

### 3.2. Опциональные поля (можно добавить позже)

⚠️ **gallery**: string[]
- Дополнительные фото
- Не обязательно для MVP

⚠️ **phone / website**: string
- Контакты бизнеса
- Можно взять из Place/Business

⚠️ **priceText**: string
- Подпись к цене ("за занятие", "за час")
- Можно добавить позже

---

## 4. ЧТО СДЕЛАТЬ OPTIONAL

### 4.1. Поля, которые можно заполнить дефолтами

🔧 **intent**
- Auto-determined по offerKind
- Показывать как hint: "Категория наследуется от места"

🔧 **ctaType**
- Auto-suggest по offerKind:
  - course → "записаться"
  - birthday → "отправить_заявку"
  - service → "отправить_заявку"

🔧 **priceText**
- Auto-generate: "от {priceFrom} BYN"

🔧 **phone / website**
- Взять из Place или Business
- Показывать как pre-filled

---

### 4.2. Поля, которые можно скрыть в "Дополнительно"

🔧 **gallery**
- Collapsed по умолчанию
- "Добавить еще фото (опционально)"

🔧 **priceLabel**
- Collapsed
- "Уточнить цену (опционально)"

---


## 5. НОВЫЙ MVP WIZARD (5 ШАГОВ)

### Шаг 1: Что предлагаете?

**Цель:** Быстро определить тип оффера

**Поля:**
- `offerKind`: course | birthday | service (обязательно)
  - **Курс / Занятия** — регулярные или разовые занятия
  - **Детский праздник** — организация дня рождения
  - **Услуга** — разовая услуга (аниматор, торт, фотограф)

**UI:**
- 3 большие карточки с иконками
- Короткий helper под каждой:
  - "Курсы английского, плавание, рисование"
  - "Организация праздника под ключ"
  - "Аниматор, торт, декор, фотограф"

**Validation:**
- Обязательно: offerKind

**Время:** 10 секунд

---

### Шаг 2: Основная информация

**Цель:** Название, описание, место

**Поля:**
- `title`: string (обязательно, min 3 chars)
  - Placeholder: "Курс английского для детей 5-7 лет"
  
- `description`: string (обязательно, min 20 chars)
  - Rich text editor (простой)
  - Placeholder: "Опишите, что входит в предложение, как проходят занятия, что получит ребенок"
  
- `placeId`: string (обязательно)
  - Dropdown с местами бизнеса
  - Hint: "Категория предложения наследуется от места"

**UI:**
- Простая форма
- Показать выбранное место с категорией:
  - "Место: Детский центр «Солнышко»"
  - "Категория: Образование → Языковые школы"

**Validation:**
- Обязательно: title, description, placeId

**Время:** 1-2 минуты

---

### Шаг 3: Для кого и как

**Цель:** Возраст, сигналы, формат

**Поля:**
- `ageMinMonths / ageMaxMonths`: number (обязательно)
  - Age range picker
  - "От 3 до 7 лет"
  
- **Signals (обязательные):**
  
  **Activity** (обязательно, 1-3)
  - Чем будут заниматься?
  - Options: educational, creative, active, calm, entertainment, social, food
  - Multi-select chips
  
  **Format** (обязательно, 1-2)
  - Где проходит?
  - Options: indoor, outdoor, online, hybrid
  - Multi-select chips
  
  **Participation** (обязательно, 1)
  - Как участвуют?
  - Options: individual, group, family
  - Single-select chips

- **Signals (опциональные, collapsed):**
  
  **Intention** (опционально, 1-2)
  - Для чего подходит?
  - Options: family-time, active-time, explore, relax, eat, walk, nature
  - Collapsed, "Добавить намерения (опционально)"
  
  **Features** (опционально, 1-3)
  - Особенности
  - Options: free, paid, booking-required, age-restricted
  - Collapsed, "Добавить особенности (опционально)"

**UI:**
- Age range: два dropdown (от/до) или slider
- Signals: chips с иконками
- Обязательные signals: всегда видны
- Опциональные: collapsed accordion

**Auto-suggestions:**
- Для course → activity: educational, creative
- Для birthday → activity: entertainment, social
- Для service → activity: entertainment

**Validation:**
- Обязательно: ageMinMonths, ageMaxMonths, activity (min 1), format (min 1), participation (1)

**Время:** 1 минута

---

### Шаг 4: Цена и запись

**Цель:** Стоимость и способ связи

**Поля:**
- `priceFrom`: number (обязательно)
  - Input: "Цена от"
  - Placeholder: "50"
  - Currency: BYN (hardcoded)
  
- `priceText`: string (опционально, collapsed)
  - "Уточнить цену (опционально)"
  - Placeholder: "за занятие", "за час", "за праздник"
  
- `ctaType`: записаться | забронировать | купить_билет | отправить_заявку | перейти_на_сайт (обязательно)
  - Auto-suggested по offerKind
  - Можно изменить
  
- `ctaPhone`: string (для записаться/отправить_заявку)
  - Pre-filled из Place или Business
  - Можно изменить
  
- `ctaLink`: string (для перейти_на_сайт/купить_билет)
  - Pre-filled из Place или Business website
  - Можно изменить

**UI:**
- Price input с валютой
- CTA type: radio buttons или dropdown
- Phone/Link: показывается в зависимости от ctaType
- Pre-filled значения выделены серым: "Телефон из профиля места"

**Auto-suggestions:**
- course → ctaType: "записаться"
- birthday → ctaType: "отправить_заявку"
- service → ctaType: "отправить_заявку"

**Validation:**
- Обязательно: priceFrom, ctaType
- Условно: ctaPhone (если записаться/отправить_заявку), ctaLink (если перейти_на_сайт/купить_билет)

**Время:** 30 секунд

---

### Шаг 5: Публикация

**Цель:** Фото и отправка

**Поля:**
- `coverImage`: string (обязательно)
  - Image upload
  - Drag & drop или выбор файла
  
- `gallery`: string[] (опционально, collapsed)
  - "Добавить еще фото (опционально)"
  - Multi-upload

**UI:**
- Большой upload area для coverImage
- Preview загруженного изображения
- Gallery: collapsed, можно добавить 2-5 фото

**Preview:**
- Показать карточку оффера как она будет выглядеть:
  - Изображение
  - Название
  - Описание (первые 120 символов)
  - Цена
  - Возраст
  - CTA кнопка

**Actions:**
- "Сохранить черновик" (DRAFT)
- "Отправить на модерацию" (PENDING)
- Для админа: "Опубликовать" (PUBLISHED)

**Validation:**
- Обязательно: coverImage

**Время:** 1 минута

---

### ИТОГО: Новый MVP Wizard

**Всего шагов:** 5  
**Обязательных полей:** 10-12  
**Опциональных полей:** 3-5  
**Условной логики:** Минимум (только ctaPhone/ctaLink)

**Время заполнения:** 2-3 минуты ✅

---

## 6. ИЗМЕНЕНИЯ В UI

### 6.1. Упрощения

✅ **Убрать вложенную логику в Step 1**
- Было: offerKind → durationType → serviceType + locationType
- Стало: только offerKind

✅ **Объединить shortDescription и description**
- Было: shortDescription (max 120) + нет полного description
- Стало: description (без ограничения)

✅ **Убрать Step 4 (Условия)**
- Было: разные поля для course/birthday/service
- Стало: всё в description

✅ **Упростить Step 5 (Pricing)**
- Было: pricingMode (single/multiple) + pricingOptions
- Стало: только priceFrom + priceText (optional)

✅ **Убрать Step 6 (Контакты)**
- Было: отдельный шаг с phone/website/socialLinks
- Стало: phone/website в Step 4 (pre-filled из Place/Business)

✅ **Упростить Step 7 (Publication)**
- Было: ctaType + ctaPhone/ctaLink + ctaInstructions + signalIds + bookingSettings
- Стало: только ctaType + ctaPhone/ctaLink (в Step 4), signalIds (в Step 3)

✅ **Переместить Signals в Step 3**
- Было: signalIds в конце (Step 7)
- Стало: signals в Step 3 (сразу после основной информации)

✅ **Переместить Media в Step 5**
- Было: Step 3 (рано)
- Стало: Step 5 (в конце, перед публикацией)

---

### 6.2. Улучшения UX

✅ **Auto-suggestions**
- ctaType по offerKind
- activity signals по offerKind
- phone/website из Place/Business

✅ **Pre-filled значения**
- phone из Place или Business
- website из Place или Business
- Показывать hint: "Телефон из профиля места"

✅ **Collapsed optional fields**
- priceText
- gallery
- intention signals
- features signals

✅ **Visual helpers**
- Иконки для offerKind
- Chips для signals
- Preview карточки оффера

✅ **Hint о категории**
- "Категория предложения наследуется от места"
- Показывать выбранную категорию Place

---

### 6.3. Новые компоненты

🆕 **OfferKindSelector**
- 3 большие карточки с иконками
- course | birthday | service

🆕 **AgeRangePicker**
- Два dropdown (от/до) или slider
- Преобразование лет → месяцы

🆕 **SignalChipSelector**
- Multi-select chips с иконками
- Группы: activity, format, participation, intention, features

🆕 **OfferPreviewCard**
- Превью как оффер будет выглядеть
- Изображение + название + описание + цена + CTA

---

## 7. ИЗМЕНЕНИЯ В VALIDATION

### 7.1. Обязательные поля (для PENDING/PUBLISHED)

```typescript
const REQUIRED_FOR_SUBMIT = {
  // Step 1
  offerKind: true,
  
  // Step 2
  title: true,
  description: true,
  placeId: true,
  
  // Step 3
  ageMinMonths: true,
  ageMaxMonths: true,
  activitySignals: true,  // min 1
  formatSignals: true,    // min 1
  participationSignals: true, // exactly 1
  
  // Step 4
  priceFrom: true,
  ctaType: true,
  ctaPhone_or_ctaLink: true, // зависит от ctaType
  
  // Step 5
  coverImage: true,
};
```

### 7.2. Минимум для DRAFT

```typescript
const REQUIRED_FOR_DRAFT = {
  offerKind: true,
  title: true,
  placeId: true,
};
```

### 7.3. Убрать избыточные validation rules

❌ **Убрать:**
- durationType validation (для course)
- serviceType validation (для service)
- locationType validation (для service)
- classDuration validation
- classFormat validation
- partyProgram validation
- partyDuration validation
- serviceDescription validation
- pricingMode validation
- bookingSettings validation

✅ **Оставить:**
- offerKind
- title (min 3 chars)
- description (min 20 chars)
- placeId
- ageMinMonths / ageMaxMonths
- activitySignals (min 1)
- formatSignals (min 1)
- participationSignals (exactly 1)
- priceFrom (> 0)
- ctaType
- ctaPhone (если ctaType = записаться/отправить_заявку)
- ctaLink (если ctaType = перейти_на_сайт/купить_билет)
- coverImage

---

## 8. РИСКИ

### Риск 1: Потеря детализации

**Проблема:**
- Убираем поля: classDuration, classFormat, partyProgram, serviceDescription
- Бизнес может хотеть указать эти детали

**Митигация:**
- Всё можно добавить в description
- Description без ограничения символов
- Можно добавить rich text formatting (списки, заголовки)

---

### Риск 2: Упрощение pricing

**Проблема:**
- Убираем pricingMode = multiple
- Бизнес может иметь несколько вариантов цен

**Митигация:**
- Для MVP достаточно priceFrom
- Можно добавить multiple pricing позже
- Можно указать варианты в description

---

### Риск 3: Убрать booking settings

**Проблема:**
- Убираем сложную структуру bookingSettings
- Бизнес может хотеть встроенное бронирование

**Митигация:**
- Для MVP достаточно ctaType = "забронировать" + ctaPhone
- Встроенное бронирование можно добавить позже
- Можно использовать ctaLink для внешнего бронирования

---

### Риск 4: Signals могут быть непонятны

**Проблема:**
- Бизнес может не понимать, что такое "activity", "format", "participation"

**Митигация:**
- Использовать понятные названия:
  - activity → "Чем будут заниматься?"
  - format → "Где проходит?"
  - participation → "Как участвуют?"
- Добавить иконки и примеры
- Auto-suggestions по offerKind

---

### Риск 5: Миграция существующих офферов

**Проблема:**
- Существующие офферы могут иметь старые поля
- Нужно мигрировать данные

**Митигация:**
- Создать migration script
- Перенести данные из старых полей в description
- Оставить старые поля в модели (deprecated)

---


## 9. ПЛАН РЕАЛИЗАЦИИ ПО ШАГАМ

### Этап 1: Подготовка (1 день)

#### 1.1. Обновить типы

**Файл:** `src/components/business/wizard/offer/types.ts`

```typescript
export interface OfferFormData {
  // Step 1: Offer Type
  offerKind: "course" | "birthday" | "service" | null;
  
  // Step 2: Basic Information
  title: string;
  description: string; // вместо shortDescription
  placeId: string | null;
  
  // Step 3: Audience and Signals
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  
  // Signals (required)
  activitySignals: string[]; // min 1, max 3
  formatSignals: string[];    // min 1, max 2
  participationSignals: string[]; // exactly 1
  
  // Signals (optional)
  intentionSignals: string[]; // max 2
  featureSignals: string[];   // max 3
  
  // Step 4: Price and CTA
  priceFrom: number | null;
  priceText: string; // optional
  ctaType: "записаться" | "забронировать" | "купить_билет" | "отправить_заявку" | "перейти_на_сайт" | null;
  ctaPhone: string;
  ctaLink: string;
  
  // Step 5: Media and Publication
  coverImage: string | null;
  gallery: string[];
  
  // Deprecated (keep for migration)
  shortDescription?: string;
  durationType?: string;
  serviceType?: string;
  locationType?: string;
  // ... other deprecated fields
}
```

#### 1.2. Обновить validation

**Файл:** `src/components/business/wizard/offer/validation.ts`

```typescript
export const REQUIRED_FOR_SUBMIT = {
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
  coverImage: true,
};

export const REQUIRED_FOR_DRAFT = {
  offerKind: true,
  title: true,
  placeId: true,
};
```

#### 1.3. Создать helper functions

**Файл:** `src/components/business/wizard/offer/helpers.ts`

```typescript
export function suggestActivitySignals(offerKind: string): string[] {
  const suggestions = {
    course: ["educational", "creative"],
    birthday: ["entertainment", "social"],
    service: ["entertainment"],
  };
  return suggestions[offerKind] || [];
}

export function suggestCTAType(offerKind: string): string {
  const suggestions = {
    course: "записаться",
    birthday: "отправить_заявку",
    service: "отправить_заявку",
  };
  return suggestions[offerKind] || "отправить_заявку";
}

export function getPlaceCategory(placeId: string): Promise<string> {
  // Fetch place category from API
}
```

---

### Этап 2: Создать новые компоненты (2-3 дня)

#### 2.1. OfferKindSelector

**Файл:** `src/components/business/wizard/offer/components/OfferKindSelector.tsx`

```typescript
interface OfferKindSelectorProps {
  value: "course" | "birthday" | "service" | null;
  onChange: (value: "course" | "birthday" | "service") => void;
}

export function OfferKindSelector({ value, onChange }: OfferKindSelectorProps) {
  const options = [
    {
      value: "course",
      label: "Курс / Занятия",
      description: "Регулярные или разовые занятия",
      icon: "��",
    },
    {
      value: "birthday",
      label: "Детский праздник",
      description: "Организация дня рождения",
      icon: "🎉",
    },
    {
      value: "service",
      label: "Услуга",
      description: "Разовая услуга (аниматор, торт, фотограф)",
      icon: "🎭",
    },
  ];
  
  return (
    <div className="grid grid-cols-3 gap-4">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "p-6 border-2 rounded-lg text-center",
            value === option.value ? "border-primary" : "border-gray-200"
          )}
        >
          <div className="text-4xl mb-2">{option.icon}</div>
          <div className="font-semibold">{option.label}</div>
          <div className="text-sm text-muted-foreground">{option.description}</div>
        </button>
      ))}
    </div>
  );
}
```

#### 2.2. AgeRangePicker

**Файл:** `src/components/business/wizard/offer/components/AgeRangePicker.tsx`

```typescript
interface AgeRangePickerProps {
  minMonths: number | null;
  maxMonths: number | null;
  onChange: (min: number, max: number) => void;
}

export function AgeRangePicker({ minMonths, maxMonths, onChange }: AgeRangePickerProps) {
  const ageOptions = [
    { label: "0-1 год", value: 0 },
    { label: "1-2 года", value: 12 },
    { label: "2-3 года", value: 24 },
    { label: "3-5 лет", value: 36 },
    { label: "5-7 лет", value: 60 },
    { label: "7-10 лет", value: 84 },
    { label: "10-14 лет", value: 120 },
    { label: "14+ лет", value: 168 },
  ];
  
  return (
    <div className="flex gap-4 items-center">
      <Select value={minMonths?.toString()} onValueChange={(v) => onChange(parseInt(v), maxMonths || 0)}>
        <SelectTrigger>
          <SelectValue placeholder="От" />
        </SelectTrigger>
        <SelectContent>
          {ageOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value.toString()}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <span>—</span>
      
      <Select value={maxMonths?.toString()} onValueChange={(v) => onChange(minMonths || 0, parseInt(v))}>
        <SelectTrigger>
          <SelectValue placeholder="До" />
        </SelectTrigger>
        <SelectContent>
          {ageOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value.toString()}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

#### 2.3. SignalChipSelector

**Файл:** `src/components/business/wizard/offer/components/SignalChipSelector.tsx`

```typescript
interface SignalChipSelectorProps {
  label: string;
  description?: string;
  options: Array<{ value: string; label: string; icon?: string }>;
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  required?: boolean;
}

export function SignalChipSelector({
  label,
  description,
  options,
  value,
  onChange,
  max,
  required,
}: SignalChipSelectorProps) {
  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      if (max && value.length >= max) {
        // Replace last if max reached
        onChange([...value.slice(0, max - 1), optionValue]);
      } else {
        onChange([...value, optionValue]);
      }
    }
  };
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => handleToggle(option.value)}
            className={cn(
              "px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors",
              value.includes(option.value)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-gray-200 hover:border-gray-300"
            )}
          >
            {option.icon && <span className="mr-1">{option.icon}</span>}
            {option.label}
          </button>
        ))}
      </div>
      
      {max && (
        <p className="text-xs text-muted-foreground">
          Выбрано: {value.length} / {max}
        </p>
      )}
    </div>
  );
}
```

#### 2.4. OfferPreviewCard

**Файл:** `src/components/business/wizard/offer/components/OfferPreviewCard.tsx`

```typescript
interface OfferPreviewCardProps {
  data: OfferFormData;
}

export function OfferPreviewCard({ data }: OfferPreviewCardProps) {
  return (
    <div className="border rounded-lg overflow-hidden max-w-sm">
      {data.coverImage && (
        <img src={data.coverImage} alt={data.title} className="w-full h-48 object-cover" />
      )}
      
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-lg">{data.title || "Название предложения"}</h3>
        
        <p className="text-sm text-muted-foreground line-clamp-3">
          {data.description || "Описание предложения"}
        </p>
        
        {data.priceFrom && (
          <div className="text-lg font-bold text-primary">
            от {data.priceFrom} BYN
            {data.priceText && <span className="text-sm font-normal"> {data.priceText}</span>}
          </div>
        )}
        
        {(data.ageMinMonths || data.ageMaxMonths) && (
          <div className="text-sm text-muted-foreground">
            Возраст: {monthsToYears(data.ageMinMonths)} - {monthsToYears(data.ageMaxMonths)} лет
          </div>
        )}
        
        {data.ctaType && (
          <button className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium">
            {getCTALabel(data.ctaType)}
          </button>
        )}
      </div>
    </div>
  );
}
```

---

### Этап 3: Обновить шаги wizard (3-4 дня)

#### 3.1. Step1Type (новый)

**Файл:** `src/components/business/wizard/offer/steps/Step1Type.tsx`

- Использовать OfferKindSelector
- Убрать durationType, serviceType, locationType
- Простой выбор из 3 вариантов

#### 3.2. Step2Information (обновить)

**Файл:** `src/components/business/wizard/offer/steps/Step2Information.tsx`

- title (обязательно)
- description (вместо shortDescription, без ограничения)
- placeId (dropdown с местами бизнеса)
- Показать hint: "Категория наследуется от места"

#### 3.3. Step3Signals (новый)

**Файл:** `src/components/business/wizard/offer/steps/Step3Signals.tsx`

- AgeRangePicker
- SignalChipSelector для activity (обязательно)
- SignalChipSelector для format (обязательно)
- SignalChipSelector для participation (обязательно)
- Collapsed: intention, features (опционально)
- Auto-suggestions по offerKind

#### 3.4. Step4PriceAndCTA (новый)

**Файл:** `src/components/business/wizard/offer/steps/Step4PriceAndCTA.tsx`

- priceFrom (обязательно)
- priceText (опционально, collapsed)
- ctaType (обязательно, auto-suggested)
- ctaPhone / ctaLink (зависит от ctaType, pre-filled)

#### 3.5. Step5Publication (обновить)

**Файл:** `src/components/business/wizard/offer/steps/Step5Publication.tsx`

- coverImage (обязательно)
- gallery (опционально, collapsed)
- OfferPreviewCard
- Actions: "Сохранить черновик" / "Отправить на модерацию"

---

### Этап 4: Обновить API mappers (1 день)

#### 4.1. buildOfferCreatePayload

**Файл:** `src/components/business/wizard/offer/mappers.ts`

```typescript
export function buildOfferCreatePayload(
  formData: OfferFormData,
  placeId: string,
  options?: { status?: "DRAFT" | "PENDING" | "PUBLISHED" }
) {
  // Combine all signals
  const discoverySignalIds = [
    ...formData.activitySignals,
    ...formData.formatSignals,
    ...formData.participationSignals,
    ...formData.intentionSignals,
    ...formData.featureSignals,
  ];
  
  return {
    source: "PLACE",
    selectedPlace: { id: placeId },
    kind: mapOfferKindToDbKind(formData.offerKind),
    title: formData.title,
    shortDescription: formData.description, // API still uses shortDescription
    ageMinMonths: formData.ageMinMonths,
    ageMaxMonths: formData.ageMaxMonths,
    coverImage: formData.coverImage,
    pricingMode: "SINGLE",
    singlePrice: formData.priceFrom,
    singlePriceLabel: formData.priceText,
    ctaType: mapCTATypeToApi(formData.ctaType),
    phone: formData.ctaPhone,
    website: formData.ctaLink,
    discoverySignalIds,
    status: options?.status || "DRAFT",
  };
}

function mapOfferKindToDbKind(kind: string): string {
  // course → CLASS
  // birthday → PARTY
  // service → VISIT
  const mapping = {
    course: "CLASS",
    birthday: "PARTY",
    service: "VISIT",
  };
  return mapping[kind] || "VISIT";
}
```

---

### Этап 5: Обновить конфигурацию шагов (1 день)

**Файл:** `src/components/business/wizard/offer/offerWizardSteps.config.tsx`

- Обновить OFFER_WIZARD_STEPS (5 шагов вместо 7)
- Обновить isComplete для каждого шага
- Обновить getSummary для каждого шага
- Обновить getMissingFields для каждого шага

---

### Этап 6: Тестирование (2 дня)

#### 6.1. Unit tests
- Validation functions
- Helper functions
- Mappers

#### 6.2. Integration tests
- Создание оффера (DRAFT)
- Создание оффера (PENDING)
- Редактирование оффера
- Auto-suggestions работают
- Pre-filled значения работают

#### 6.3. E2E tests
- Полный flow создания оффера
- Проверка всех шагов
- Проверка validation
- Проверка preview

---

### Этап 7: Миграция существующих офферов (1 день)

**Скрипт:** `scripts/migrate-offers.ts`

```typescript
// Migrate old offer fields to new structure
async function migrateOffers() {
  const offers = await prisma.offer.findMany();
  
  for (const offer of offers) {
    // Migrate shortDescription → description
    // Migrate old signals → new signal structure
    // Set default values for new fields
    
    await prisma.offer.update({
      where: { id: offer.id },
      data: {
        // ... migration logic
      },
    });
  }
}
```

---

## 10. ИТОГОВАЯ СВОДКА

### До упрощения:
- ❌ 8 шагов (7 контентных + 1 review)
- ❌ 15-20 обязательных полей
- ❌ 20-25 опциональных полей
- ❌ Много условной логики
- ❌ Время заполнения: 10-15 минут

### После упрощения:
- ✅ 5 шагов
- ✅ 10-12 обязательных полей
- ✅ 3-5 опциональных полей
- ✅ Минимум условной логики
- ✅ Время заполнения: 2-3 минуты

### Ключевые улучшения:
1. **Убрана избыточная детализация** — всё в description
2. **Упрощен pricing** — только priceFrom
3. **Убран сложный booking** — только ctaType + phone/link
4. **Signals перемещены раньше** — в Step 3
5. **Auto-suggestions** — ctaType, activity signals, phone/website
6. **Pre-filled значения** — из Place/Business
7. **Collapsed optional** — gallery, priceText, intention, features

### Время реализации:
- **Этап 1:** 1 день (подготовка)
- **Этап 2:** 2-3 дня (новые компоненты)
- **Этап 3:** 3-4 дня (обновить шаги)
- **Этап 4:** 1 день (API mappers)
- **Этап 5:** 1 день (конфигурация)
- **Этап 6:** 2 дня (тестирование)
- **Этап 7:** 1 день (миграция)

**ИТОГО:** 11-13 дней (2-2.5 недели)

---

**Документ готов к реализации**  
**Дата:** 5 мая 2026  
**Автор:** Kiro AI

