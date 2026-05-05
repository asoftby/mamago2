# АУДИТ СУЩНОСТИ OFFER В ПРОЕКТЕ MAMAGO

**Дата:** 5 мая 2026  
**Статус:** Полный анализ текущей реализации  
**Цель:** Определить роль Offer в продукте и предложить план улучшений

---

## 1. ТЕКУЩЕЕ СОСТОЯНИЕ

### 1.1. Модель данных (Prisma)

```prisma
model Offer {
  id                       String             @id @default(cuid())
  placeId                  String
  kind                     OfferKind          // EVENT | SERVICE
  title                    String
  description              String?
  coverImage               String?
  priceFrom                Float?
  priceText                String?
  ageMinMonths             Int?
  ageMaxMonths             Int?
  dateFrom                 DateTime?
  dateTo                   DateTime?
  promoTitle               String?
  promoDescription         String?
  promoUntil               DateTime?
  status                   OfferStatus        // DRAFT | PENDING | PUBLISHED
  publishedAt              DateTime?
  rejectionReason          String?
  createdAt                DateTime
  updatedAt                DateTime
  inheritPlaceOpeningHours Boolean            @default(true)
  openingHoursId           String?
  discoverySignalIds       String[]           @default([])
  
  // Booking
  bookingEnabled Boolean      @default(false)
  bookingMode    BookingMode? // REQUEST_ONLY | USE_PUBLICATION_DATES
  bookingPhone   String?
  bookingNote    String?
  
  // SEO
  seoCanonicalUrl    String?
  seoDescription     String?
  seoH1              String?
  seoJsonLdOverride  Json?
  seoOgDescription   String?
  seoOgImage         String?
  seoOgTitle         String?
  seoRobots          String?
  seoTitle           String?
  slug               String?            @unique
  slugUpdatedAt      DateTime?
  seoCanonicalSource SeoCanonicalSource @default(FALLBACK)
  
  // Relations
  place           Place
  openingHours    OpeningHours?
  slugHistory     OfferSlugHistory[]
  boosts          Boost[]
  bookingRequests BookingRequest[]
}

enum OfferKind {
  EVENT    // Билет на событие
  SERVICE  // Услуга / занятие
}

enum OfferStatus {
  DRAFT
  PENDING
  PUBLISHED
}
```

**Ключевые поля:**
- `kind`: EVENT vs SERVICE — основное разделение
- `placeId`: обязательная привязка к Place
- `dateFrom/dateTo`: опциональный период актуальности
- `discoverySignalIds`: сигналы для рекомендаций
- `bookingEnabled/bookingMode`: встроенная система записи
- `promoTitle/promoDescription/promoUntil`: промо-акции

**Что используется:**
- ✅ Основные поля: title, description, coverImage, price
- ✅ Возраст: ageMinMonths, ageMaxMonths
- ✅ Статус модерации: status, publishedAt
- ✅ SEO: slug, seoTitle, seoDescription
- ✅ Booking: bookingEnabled, bookingMode, bookingPhone

**Что НЕ используется / используется слабо:**
- ⚠️ `kind`: есть в модели, но UI wizard не различает EVENT vs SERVICE четко
- ⚠️ `dateFrom/dateTo`: есть в модели, но wizard не работает с датами
- ⚠️ `promoTitle/promoDescription/promoUntil`: промо-поля не используются в wizard
- ⚠️ `openingHoursId`: наследование расписания от Place не реализовано
- ⚠️ `discoverySignalIds`: есть в модели, но нет mapping как у Event



### 1.2. API Endpoints

#### Business API

**POST /api/business/offers**
- Создание нового оффера
- Поддерживает только `source: "PLACE"` (EVENT source не реализован)
- Mapping `kind`: `EVENT_TICKET` → `EVENT`, остальные → `SERVICE`
- Автоматический расчет `priceFrom` из pricing options
- Валидация доступа к Place через `ownerBusinessId`
- Auto-assign slug при первом заполнении title

**GET /api/business/offers**
- Список офферов текущего бизнеса
- Админ/модератор видят все офферы
- Бизнес видит только свои (через placeId)

**GET /api/business/offers/[id]**
- Получение одного оффера
- Проверка доступа через `ownerBusinessId`

**PATCH /api/business/offers/[id]**
- Обновление оффера
- Пересчет `priceFrom/priceText` при изменении pricing
- Slug guard: при публикации проверяется наличие slug
- Валидация прав доступа

**DELETE /api/business/offers/[id]**
- Удаление только DRAFT офферов
- Проверка владения через Place

#### Public API

**GET /offers/[slug]**
- Публичная страница оффера
- Поддержка legacy ID (redirect на slug)
- SEO meta tags
- JSON-LD schema
- Analytics beacon

**Что отсутствует:**
- ❌ Нет публичного API для списка офферов
- ❌ Нет фильтрации офферов по категориям/сигналам
- ❌ Нет API для получения офферов по Place
- ❌ Нет интеграции с фидами "Куда пойти" / "Занятия"

---

### 1.3. UI (Offer Wizard)

**Архитектура:** Наследует Event Wizard 1-to-1

**Шаги:**

1. **Step 1: Тип предложения**
   - `offerKind`: course | birthday | service
   - Для course: `durationType` (single | recurring | camp)
   - Для service: `serviceType` + `locationType`
   - Auto-определение `intent`: "куда_пойти" | "занятия" | "день_рождения"

2. **Step 2: Публичная информация**
   - title, shortDescription, ageGroups

3. **Step 3: Медиа**
   - coverImage, gallery

4. **Step 4: Формат и условия**
   - Для course: classDuration, classGroupSize, classFormat
   - Для camp: campSessions (dateFrom/dateTo), campPriceText
   - Для birthday: partyProgram, partyDuration, partyChildrenCount
   - Для service: serviceDescription, serviceDuration, serviceDeliveryArea

5. **Step 5: Ценообразование**
   - pricingMode: single | multiple
   - singlePrice + singlePriceLabel
   - pricingOptions: [{title, price, oldPrice, description}]

6. **Step 6: Контакты**
   - phone, website, socialLinks

7. **Step 7: CTA и публикация**
   - ctaType: записаться | забронировать | купить_билет | отправить_заявку | перейти_на_сайт
   - Booking settings (для "забронировать")
   - signalIds (Discovery signals)

**Проблемы UI:**

❌ **Перегруженность шагов**
- 7 шагов для создания оффера — слишком много
- Многие поля опциональные, но wizard требует их заполнения
- Нет четкого разделения "минимум" vs "детали"

❌ **Смешение сценариев**
- "Курс" vs "Праздник" vs "Услуга" — разные продукты, но один wizard
- Условная логика (if offerKind === "course") усложняет код
- Нет специализированных форм под каждый тип

❌ **Отсутствие связи с моделью**
- Wizard работает с `offerKind: "course" | "birthday" | "service"`
- Модель хранит `kind: EVENT | SERVICE`
- Mapping неочевиден: birthday → SERVICE? course → SERVICE? EVENT_TICKET → EVENT?

❌ **Signals не работают**
- Есть поле `signalIds` в форме
- Нет автоматического mapping как у Event
- Нет валидации signals для Offer

---

### 1.4. Использование в продукте

#### 4.1. Birthday Builder

**Файл:** `src/features/birthday/types/birthday.ts`

```typescript
export type BirthdayOfferType =
  | "BIRTHDAY_PACKAGE"
  | "BIRTHDAY_VENUE_OFFER"
  | "BIRTHDAY_SERVICE_OFFER"
  | "BIRTHDAY_ADDON";

export type BirthdayOfferCategory =
  | "PACKAGE"
  | "VENUE"
  | "ANIMATOR"
  | "SHOW"
  | "MASTER_CLASS"
  | "CAKE"
  | "DECOR"
  | "PHOTO"
  | "FOOD"
  | "ADDON";

export type OfferLayer = "BASE" | "ENTERTAINMENT" | "FOOD" | "DECOR" | "EXTRA";
```

**Использование:**
- ✅ Birthday Builder активно использует Offer
- ✅ Есть типизация: BirthdayOffer с полями layer, category, compatibility
- ✅ Есть логика фильтрации по возрасту, бюджету, формату
- ✅ Есть система совместимости офферов (compatibleBaseTypes, requiresSelectedVenue)

**Проблема:**
- ❌ Birthday Builder использует **свою типизацию** (BirthdayOffer)
- ❌ Нет связи с моделью Offer из Prisma
- ❌ Непонятно, как BirthdayOffer создается из Offer
- ❌ Нет API для получения офферов для Birthday Builder

#### 4.2. Публичная страница

**Файл:** `src/app/(public)/offers/[slug]/page.tsx`

- ✅ Есть публичная страница `/offers/[slug]`
- ✅ SEO meta tags
- ✅ JSON-LD schema
- ✅ Analytics beacon
- ✅ Redirect с legacy ID на slug

**Проблема:**
- ❌ Страница очень простая: только title + description
- ❌ Нет отображения price, age, booking
- ❌ Нет CTA кнопок
- ❌ Нет связи с Place (только название)
- ❌ Нет похожих офферов
- ❌ Нет отзывов

#### 4.3. Поиск и индексация

**Файл:** `src/lib/search/builders/buildOfferDocument.ts`

- ✅ Offer индексируется в поиске
- ✅ Поля: title, description, promoTitle, promoDescription, place.title, city.name
- ✅ Meta line: priceText, priceFrom, placeCity, placeTitle
- ✅ URL: `/offers/{slug}` или `/offers/{id}`
- ✅ Boost: SEARCH_BOOST.offer

**Проблема:**
- ❌ Нет фильтрации по kind (EVENT vs SERVICE)
- ❌ Нет фильтрации по signals
- ❌ Нет фильтрации по возрасту
- ❌ Offer не попадает в основные фиды "Куда пойти" / "Занятия"

#### 4.4. My Plan

**Использование:** Минимальное

- ❌ Offer не добавляется в My Plan напрямую
- ❌ Нет UI для добавления Offer в план
- ❌ Нет связи Offer ↔ PlanItem

**Возможная интеграция:**
- Offer с `kind: EVENT` + dateFrom/dateTo → можно добавить в план как событие
- Offer с `kind: SERVICE` → нельзя добавить в план (нет даты)

#### 4.5. Рекомендации

**Использование:** Только Birthday Builder

- ❌ Offer не участвует в общих рекомендациях
- ❌ Нет персонализации по signals
- ❌ Нет "Похожие офферы"
- ❌ Нет "Реши за меня" для офферов

---

## 2. НАЙДЕННЫЕ ПРОБЛЕМЫ (ТОП-5)

### 🔴 Проблема 1: Нет четкой роли Offer в продукте

**Суть:**
- Offer существует, но не понятно, зачем
- Event уже покрывает "куда пойти" (спектакли, концерты, мастер-классы)
- Place уже покрывает "места" (музеи, парки, кафе)
- Offer висит между ними без четкой ниши

**Последствия:**
- Бизнес не понимает, когда создавать Event, а когда Offer
- Пользователи не видят офферы в основных фидах
- Офферы не участвуют в рекомендациях
- Офферы не добавляются в My Plan

**Пример:**
- "Мастер-класс по рисованию" — это Event или Offer?
- "Абонемент в бассейн" — это Offer или просто информация в Place?
- "Билет на спектакль" — это Event или Offer?

---

### 🔴 Проблема 2: Дублирование с Event

**Суть:**
- Offer.kind = EVENT дублирует Activity (Event)
- Оба имеют: title, description, coverImage, price, age, dates
- Оба могут быть "билетом на событие"

**Различия:**
| Поле | Event (Activity) | Offer |
|------|------------------|-------|
| Привязка | placeId (optional) | placeId (required) |
| Категория | eventCategoryId + genreSlugs | нет |
| Расписание | scheduleJson + sessions | dateFrom/dateTo |
| Signals | discoverySignalIds (с mapping) | discoverySignalIds (без mapping) |
| Venue | EventVenue (kind: PLACE/CUSTOM/ONLINE) | только Place |
| Booking | bookingEnabled + bookingMode | bookingEnabled + bookingMode |

**Проблема:**
- Непонятно, когда использовать Event, а когда Offer
- Offer.kind = EVENT не имеет категорий (нет eventCategoryId)
- Offer не участвует в фидах событий

---

### 🔴 Проблема 3: Wizard не соответствует модели

**Суть:**
- Wizard работает с `offerKind: "course" | "birthday" | "service"`
- Модель хранит `kind: EVENT | SERVICE`
- Mapping неочевиден и не документирован

**Текущий mapping (из API):**
```typescript
const dbKind = data.kind === "EVENT_TICKET" ? "EVENT" : "SERVICE";
```

**Проблемы:**
- "course" → SERVICE ✅
- "birthday" → SERVICE ✅
- "service" → SERVICE ✅
- "EVENT_TICKET" → EVENT ✅

Но wizard не предлагает выбрать "EVENT_TICKET" явно!

**Wizard предлагает:**
- Курс / занятия
- Детский праздник
- Услуга

**Где "Билет на событие"?**

---

### 🔴 Проблема 4: Signals не работают

**Суть:**
- У Event есть автоматический mapping: category/genres → signals
- У Offer нет mapping: wizard просто показывает поле `signalIds`
- Нет валидации: какие signals можно использовать для Offer?

**Последствия:**
- Офферы не участвуют в рекомендациях
- Нет персонализации по signals
- Нет фильтрации офферов по activity/intention/interests

**Что нужно:**
- Определить, какие signals применимы к Offer
- Создать mapping: offerKind → suggested signals
- Валидировать signals при сохранении

---

### 🔴 Проблема 5: Слабая интеграция с продуктом

**Суть:**
- Offer не попадает в основные фиды
- Offer не добавляется в My Plan
- Offer не участвует в "Реши за меня"
- Offer используется только в Birthday Builder

**Последствия:**
- Бизнес создает офферы, но пользователи их не видят
- Офферы не приносят трафик
- Офферы не монетизируются

**Что нужно:**
- Определить, где офферы должны показываться
- Интегрировать офферы в фиды
- Добавить офферы в My Plan (если kind = EVENT)
- Добавить офферы в рекомендации


---

## 3. ПРИМЕРЫ РЕАЛЬНЫХ КЕЙСОВ

### Кейс 1: Абонемент в бассейн

**Что это:**
- Регулярные занятия плаванием для детей 3-7 лет
- 8 занятий по 45 минут
- Цена: 120 BYN

**Как сейчас:**
- Создается как Offer (kind: SERVICE, offerKind: "course")
- Привязан к Place (бассейн)
- Не попадает в фиды "Занятия"
- Не добавляется в My Plan

**Проблемы:**
- Пользователь ищет "занятия плаванием" → находит Events, но не Offers
- Offer не имеет category/genre → не фильтруется
- Offer не имеет signals → не персонализируется

**Что должно быть:**
- Offer должен попадать в фид "Занятия"
- Offer должен иметь signals: activity=sport, interests=sport
- Offer должен фильтроваться по возрасту и категории

---

### Кейс 2: Билет на спектакль

**Что это:**
- Спектакль "Колобок" в театре
- Дата: 15 мая 2026, 11:00
- Цена: 25 BYN

**Как сейчас:**
- Может быть создан как Event (Activity)
- Может быть создан как Offer (kind: EVENT)
- Непонятно, что выбрать

**Проблемы:**
- Дублирование: Event и Offer покрывают один кейс
- Если создать как Offer → не попадет в фид "Куда пойти"
- Если создать как Event → зачем тогда Offer.kind = EVENT?

**Что должно быть:**
- Определить: Event = основной контент, Offer = промо/акция?
- Или: Event = разовое событие, Offer = регулярное предложение?
- Или: убрать Offer.kind = EVENT совсем?

---

### Кейс 3: Детский праздник "под ключ"

**Что это:**
- Организация дня рождения в кафе
- Программа: аниматор + торт + декор
- Цена: от 300 BYN

**Как сейчас:**
- Создается как Offer (kind: SERVICE, offerKind: "birthday")
- Используется в Birthday Builder
- Не попадает в основные фиды

**Проблемы:**
- Birthday Builder использует свою типизацию (BirthdayOffer)
- Нет связи с моделью Offer
- Непонятно, как BirthdayOffer создается из Offer

**Что должно быть:**
- Четкая связь: Offer → BirthdayOffer
- API для получения офферов для Birthday Builder
- Фильтрация по BirthdayOfferCategory

---

### Кейс 4: Мастер-класс по рисованию

**Что это:**
- Разовое занятие для детей 5-10 лет
- Дата: 20 мая 2026, 14:00
- Цена: 30 BYN

**Как сейчас:**
- Может быть Event (Activity с eventCategory = "workshops")
- Может быть Offer (kind: SERVICE, offerKind: "course", durationType: "single")

**Проблемы:**
- Дублирование: Event и Offer покрывают один кейс
- Если Event → попадает в фид "Куда пойти", имеет category/genre
- Если Offer → не попадает в фиды, не имеет category

**Что должно быть:**
- Определить: разовое занятие = Event, курс = Offer?
- Или: всё с датой = Event, всё без даты = Offer?

---

### Кейс 5: Услуга аниматора на выезд

**Что это:**
- Аниматор приезжает на дом
- Программа: 1 час, до 10 детей
- Цена: 80 BYN

**Как сейчас:**
- Создается как Offer (kind: SERVICE, offerKind: "service", serviceType: "аниматор")
- Не привязан к конкретному месту (locationType: "client_location")
- Используется в Birthday Builder

**Проблемы:**
- Offer требует placeId, но услуга на выезд не привязана к месту
- Приходится создавать "виртуальный" Place для бизнеса
- Непонятно, как показывать такие офферы на карте

**Что должно быть:**
- Разрешить Offer без placeId для услуг на выезд
- Или: создать отдельную сущность Service
- Или: использовать Place бизнеса как "офис", а не место оказания услуги

---

### Кейс 6: Промо-акция "Скидка 20% на абонемент"

**Что это:**
- Временная акция на абонемент в бассейн
- Действует до 31 мая 2026
- Цена: 96 BYN вместо 120 BYN

**Как сейчас:**
- Модель имеет поля: promoTitle, promoDescription, promoUntil
- Wizard не работает с промо-полями
- Нет UI для создания промо-акций

**Проблемы:**
- Промо-поля не используются
- Нет способа создать временную акцию
- Нет отображения "старая цена / новая цена" на публичной странице

**Что должно быть:**
- Wizard должен поддерживать промо-акции
- Публичная страница должна показывать промо
- Фиды должны выделять офферы с активными промо

---

### Кейс 7: Лагерь на летние каникулы

**Что это:**
- Детский лагерь, 3 смены
- Смена 1: 1-14 июня
- Смена 2: 15-28 июня
- Смена 3: 1-14 июля
- Цена: 500 BYN за смену

**Как сейчас:**
- Wizard поддерживает durationType: "camp"
- Можно добавить несколько смен (campSessions)
- Но модель не хранит смены (нет отдельной таблицы)

**Проблемы:**
- Wizard собирает campSessions, но API не сохраняет их
- Модель имеет только dateFrom/dateTo (одна дата)
- Нет способа показать "выберите смену" на публичной странице

**Что должно быть:**
- Создать модель OfferSession (аналог ActivitySession)
- Сохранять смены в отдельной таблице
- Публичная страница должна показывать список смен
- Booking должен работать с выбором смены

---

## 4. АРХИТЕКТУРНЫЕ ВЫВОДЫ

### 4.1. Offer vs Event: в чем разница?

**Текущая ситуация:**
- Event (Activity) = событие с датой и временем
- Offer = предложение от бизнеса (может быть с датой или без)

**Проблема:**
- Offer.kind = EVENT дублирует Activity
- Непонятно, когда использовать Event, а когда Offer

**Варианты решения:**

#### Вариант A: Offer = промо-обертка над Event/Place

**Концепция:**
- Event = основной контент (спектакль, концерт, мастер-класс)
- Offer = промо-предложение от бизнеса (скидка, акция, пакет)
- Offer ссылается на Event или Place

**Модель:**
```prisma
model Offer {
  placeId   String?
  eventId   String?  // NEW: ссылка на Activity
  kind      OfferKind // PROMO | PACKAGE | SUBSCRIPTION
  // ...
}
```

**Плюсы:**
- ✅ Четкое разделение: Event = контент, Offer = коммерция
- ✅ Offer не дублирует Event
- ✅ Можно создать Offer на существующий Event

**Минусы:**
- ❌ Нужно рефакторить модель
- ❌ Нужно рефакторить wizard
- ❌ Нужно мигрировать существующие офферы

---

#### Вариант B: Убрать Offer.kind = EVENT

**Концепция:**
- Event = всё, что имеет дату и время (спектакли, концерты, мастер-классы)
- Offer = только услуги и абонементы (без конкретной даты)
- Offer.kind = SERVICE (убрать EVENT)

**Модель:**
```prisma
model Offer {
  kind OfferKind // только SERVICE
  // убрать dateFrom/dateTo
}
```

**Плюсы:**
- ✅ Нет дублирования с Event
- ✅ Четкое разделение: Event = с датой, Offer = без даты
- ✅ Проще для бизнеса: "событие" vs "услуга"

**Минусы:**
- ❌ Нужно мигрировать существующие Offer с kind = EVENT
- ❌ Теряем возможность создавать "билеты" через Offer

---

#### Вариант C: Offer = только для Birthday Builder

**Концепция:**
- Event = основной контент для всех фидов
- Offer = специализированная сущность только для Birthday Builder
- Offer не показывается в основных фидах

**Модель:**
```prisma
model Offer {
  kind              OfferKind // BIRTHDAY_PACKAGE | BIRTHDAY_SERVICE
  birthdayCategory  BirthdayOfferCategory
  layer             OfferLayer
  // ...
}
```

**Плюсы:**
- ✅ Четкая роль: Offer = только для дней рождения
- ✅ Нет конфликта с Event
- ✅ Можно оптимизировать под Birthday Builder

**Минусы:**
- ❌ Ограниченная область применения
- ❌ Нужно создать другую сущность для "услуг" (абонементы, курсы)

---

### 4.2. Нужен ли OfferFormat?

**Аналогия с Event:**
- Event имеет EventCategory + Genre
- Offer не имеет категорий

**Варианты:**

#### Вариант 1: Использовать EventCategory

**Концепция:**
- Offer использует те же категории, что и Event
- Offer.eventCategoryId → EventCategory

**Плюсы:**
- ✅ Единая таксономия
- ✅ Не нужно создавать новые справочники

**Минусы:**
- ❌ EventCategory заточена под события (спектакли, концерты)
- ❌ Не подходит для услуг (абонементы, курсы)

---

#### Вариант 2: Создать OfferCategory

**Концепция:**
- Создать отдельный справочник OfferCategory
- Категории: SUBSCRIPTION | COURSE | PARTY | SERVICE | TICKET

**Модель:**
```prisma
model OfferCategory {
  id     String
  slug   String @unique
  nameRu String
  nameEn String
}

model Offer {
  categoryId String?
  category   OfferCategory?
}
```

**Плюсы:**
- ✅ Специализированные категории для офферов
- ✅ Можно фильтровать офферы по категориям
- ✅ Можно создать mapping: category → signals

**Минусы:**
- ❌ Еще один справочник
- ❌ Нужно заполнять категории
- ❌ Дублирование с EventCategory

---

#### Вариант 3: Использовать только Signals

**Концепция:**
- Не создавать категории
- Использовать только discoverySignalIds для классификации

**Плюсы:**
- ✅ Не нужно создавать справочники
- ✅ Гибкая классификация через signals

**Минусы:**
- ❌ Signals не заменяют категории (слишком детальные)
- ❌ Нет иерархии (категория → подкатегория)
- ❌ Сложно для бизнеса (что такое "signals"?)

---

### 4.3. Как разделить "куда пойти" vs "занятия"?

**Текущая ситуация:**
- Event попадает в фид "Куда пойти"
- Offer не попадает никуда

**Варианты:**

#### Вариант 1: По наличию даты

**Правило:**
- Если есть конкретная дата → "Куда пойти"
- Если нет даты → "Занятия"

**Применение:**
- Event (всегда с датой) → "Куда пойти"
- Offer (может быть без даты) → "Занятия"

**Плюсы:**
- ✅ Простое правило
- ✅ Понятно пользователю

**Минусы:**
- ❌ Мастер-класс с датой → "Куда пойти", но это занятие
- ❌ Абонемент без даты → "Занятия", но может быть с расписанием

---

#### Вариант 2: По категории

**Правило:**
- Категории "спектакли", "концерты", "выставки" → "Куда пойти"
- Категории "курсы", "абонементы", "занятия" → "Занятия"

**Применение:**
- Event с eventCategory = "theatre" → "Куда пойти"
- Offer с offerCategory = "COURSE" → "Занятия"

**Плюсы:**
- ✅ Гибкое разделение
- ✅ Можно настроить под любой кейс

**Минусы:**
- ❌ Нужно создать OfferCategory
- ❌ Нужно заполнить категории для всех офферов

---

#### Вариант 3: По intent (из wizard)

**Правило:**
- Wizard определяет intent: "куда_пойти" | "занятия" | "день_рождения"
- Offer сохраняет intent в модели
- Фиды фильтруют по intent

**Модель:**
```prisma
model Offer {
  intent OfferIntent // WHERE_TO_GO | ACTIVITIES | BIRTHDAY
}
```

**Плюсы:**
- ✅ Явное указание intent
- ✅ Wizard уже определяет intent

**Минусы:**
- ❌ Нужно добавить поле в модель
- ❌ Нужно мигрировать существующие офферы


---

## 5. КОНКРЕТНЫЙ ПЛАН ИЗМЕНЕНИЙ

### Рекомендуемый подход: **Вариант B + Signals**

**Концепция:**
1. Убрать Offer.kind = EVENT (оставить только SERVICE)
2. Event = всё с конкретной датой
3. Offer = услуги, абонементы, курсы (без конкретной даты)
4. Использовать Signals для классификации и рекомендаций
5. Добавить intent для разделения фидов

---

### ШАГ 1: Рефакторинг модели данных

#### 1.1. Изменить enum OfferKind

```prisma
enum OfferKind {
  SERVICE       // Услуга (аниматор, фотограф, торт)
  SUBSCRIPTION  // Абонемент (бассейн, спортзал)
  COURSE        // Курс (английский, рисование)
  PACKAGE       // Пакет (день рождения под ключ)
}
```

**Миграция:**
- Все Offer с kind = EVENT → мигрировать в Activity
- Все Offer с kind = SERVICE → определить новый kind

---

#### 1.2. Добавить поле intent

```prisma
model Offer {
  intent OfferIntent @default(ACTIVITIES)
}

enum OfferIntent {
  ACTIVITIES  // Занятия (курсы, абонементы)
  BIRTHDAY    // День рождения (пакеты, услуги)
  SERVICES    // Услуги (разовые, на выезд)
}
```

**Использование:**
- Wizard автоматически определяет intent
- Фиды фильтруют по intent
- "Занятия" = intent: ACTIVITIES
- Birthday Builder = intent: BIRTHDAY

---

#### 1.3. Добавить таблицу OfferSession (для лагерей)

```prisma
model OfferSession {
  id        String   @id @default(cuid())
  offerId   String
  startsAt  DateTime
  endsAt    DateTime
  title     String?  // "Смена 1", "Смена 2"
  capacity  Int?
  createdAt DateTime @default(now())
  
  offer           Offer            @relation(fields: [offerId], references: [id], onDelete: Cascade)
  bookingRequests BookingRequest[]
  
  @@index([offerId])
  @@index([startsAt])
}

model Offer {
  sessions OfferSession[]
}
```

**Использование:**
- Для kind = COURSE + durationType = "camp"
- Wizard сохраняет campSessions в OfferSession
- Публичная страница показывает список смен
- Booking работает с выбором смены

---

#### 1.4. Сделать placeId опциональным

```prisma
model Offer {
  placeId String?  // Опционально для услуг на выезд
  place   Place?   @relation(fields: [placeId], references: [id])
}
```

**Использование:**
- Для услуг на выезд (аниматор, фотограф) placeId = null
- Для курсов/абонементов placeId = обязательно

---

### ШАГ 2: Создать Offer Signal Mapping

#### 2.1. Определить mapping

**Файл:** `src/lib/offer/offerSignalMapping.ts`

```typescript
export const OFFER_SIGNAL_MAPPING: Record<OfferKind, SignalMapping> = {
  SUBSCRIPTION: {
    activity: ["active", "sport"],
    intention: ["active-time"],
    interests: ["sport"],
  },
  COURSE: {
    activity: ["educational", "creative"],
    intention: ["family-time"],
    interests: ["creative", "science"],
  },
  PACKAGE: {
    activity: ["entertainment", "social"],
    intention: ["family-time"],
    interests: [],
  },
  SERVICE: {
    activity: ["entertainment"],
    intention: ["family-time"],
    interests: [],
  },
};
```

#### 2.2. Создать API endpoint

**GET /api/offers/suggested-signals**
- Параметры: offerKind, serviceType
- Возвращает: suggested discoverySignalIds

**Использование:**
- Wizard вызывает API при выборе offerKind
- Автоматически предлагает signals
- Пользователь может редактировать

---

### ШАГ 3: Упростить Wizard

#### 3.1. Убрать лишние шаги

**Было:** 7 шагов  
**Станет:** 5 шагов

1. **Тип и детали** (объединить Step 1 + Step 2)
   - offerKind + durationType + serviceType
   - title + shortDescription + ageGroups

2. **Медиа**
   - coverImage + gallery

3. **Условия и цена** (объединить Step 4 + Step 5)
   - Условия (зависят от offerKind)
   - Pricing (single/multiple)

4. **Контакты и CTA** (объединить Step 6 + Step 7)
   - phone + website
   - ctaType + booking settings

5. **Signals и публикация**
   - Автоматически предложенные signals
   - Статус (DRAFT/PENDING/PUBLISHED)

---

#### 3.2. Специализировать формы

**Вместо одного wizard с условной логикой:**

- `CourseOfferWizard` — для курсов и абонементов
- `BirthdayOfferWizard` — для дней рождения
- `ServiceOfferWizard` — для услуг

**Плюсы:**
- ✅ Каждый wizard заточен под свой кейс
- ✅ Нет условной логики (if offerKind === "course")
- ✅ Проще поддерживать

---

### ШАГ 4: Интегрировать в фиды

#### 4.1. Создать публичный API

**GET /api/public/offers**
- Параметры: intent, cityId, ageMinMonths, ageMaxMonths, signalIds
- Возвращает: список офферов

**Использование:**
- Фид "Занятия" → intent: ACTIVITIES
- Birthday Builder → intent: BIRTHDAY

---

#### 4.2. Добавить в фид "Занятия"

**Файл:** `src/app/(public)/activities/page.tsx`

**Логика:**
- Показывать Event + Offer
- Event = с конкретной датой
- Offer = без даты (курсы, абонементы)
- Фильтрация по signals

---

#### 4.3. Улучшить публичную страницу

**Файл:** `src/app/(public)/offers/[slug]/page.tsx`

**Добавить:**
- ✅ Отображение price (priceFrom, priceText)
- ✅ Отображение age (ageMinMonths, ageMaxMonths)
- ✅ CTA кнопка (ctaType)
- ✅ Booking форма (если bookingEnabled)
- ✅ Связь с Place (адрес, карта)
- ✅ Похожие офферы (по signals)
- ✅ Промо-акция (promoTitle, promoUntil)

---

### ШАГ 5: Интегрировать с My Plan

#### 5.1. Разрешить добавление Offer в план

**Условие:**
- Только Offer с sessions (лагеря)
- Пользователь выбирает смену → добавляется в план

**Модель:**
```prisma
model PlanItem {
  offerId        String?
  offerSessionId String?
  
  offer        Offer?        @relation(fields: [offerId], references: [id])
  offerSession OfferSession? @relation(fields: [offerSessionId], references: [id])
}
```

---

### ШАГ 6: Добавить в рекомендации

#### 6.1. Использовать signals

**Логика:**
- Offer с discoverySignalIds участвует в рекомендациях
- Персонализация по User.profileSignalIds
- Фильтрация по возрасту детей

#### 6.2. Добавить в "Реши за меня"

**Сценарий:**
- Пользователь: "Хочу записать ребенка на плавание"
- Система: находит Offer с signals: activity=sport, interests=sport
- Показывает абонементы в бассейны

---

### ШАГ 7: Связать с Birthday Builder

#### 7.1. Создать API

**GET /api/birthday/offers**
- Параметры: ageGroup, budgetGroup, format, theme
- Возвращает: BirthdayOffer[]

**Логика:**
- Фильтрация Offer с intent: BIRTHDAY
- Mapping Offer → BirthdayOffer
- Фильтрация по compatibility

---

#### 7.2. Добавить поля в модель

```prisma
model Offer {
  birthdayCategory  BirthdayOfferCategory?
  layer             OfferLayer?
  compatibilityJson Json?  // OfferCompatibility
}

enum BirthdayOfferCategory {
  PACKAGE
  VENUE
  ANIMATOR
  SHOW
  MASTER_CLASS
  CAKE
  DECOR
  PHOTO
  FOOD
  ADDON
}

enum OfferLayer {
  BASE
  ENTERTAINMENT
  FOOD
  DECOR
  EXTRA
}
```

---

## 6. ПРИОРИТИЗАЦИЯ

### Фаза 1: Критические изменения (1-2 недели)

1. ✅ Рефакторинг модели: убрать Offer.kind = EVENT
2. ✅ Добавить intent в модель
3. ✅ Создать Offer Signal Mapping
4. ✅ Упростить Wizard (объединить шаги)
5. ✅ Создать публичный API /api/public/offers

**Результат:**
- Offer имеет четкую роль (услуги, курсы, абонементы)
- Нет дублирования с Event
- Signals работают

---

### Фаза 2: Интеграция в продукт (2-3 недели)

1. ✅ Добавить Offer в фид "Занятия"
2. ✅ Улучшить публичную страницу Offer
3. ✅ Добавить Offer в рекомендации
4. ✅ Создать API для Birthday Builder
5. ✅ Добавить OfferSession для лагерей

**Результат:**
- Offer попадает в основные фиды
- Пользователи видят офферы
- Офферы участвуют в рекомендациях

---

### Фаза 3: Улучшения UX (1-2 недели)

1. ✅ Специализировать wizards (Course/Birthday/Service)
2. ✅ Добавить промо-акции в wizard
3. ✅ Добавить Offer в My Plan
4. ✅ Добавить "Похожие офферы"
5. ✅ Добавить отзывы на Offer

**Результат:**
- Wizard удобен для бизнеса
- Пользователи могут планировать офферы
- Офферы имеют социальные доказательства

---

## 7. МЕТРИКИ УСПЕХА

### До изменений:
- ❌ Offer не попадает в фиды
- ❌ 0% офферов в My Plan
- ❌ 0% офферов в рекомендациях
- ❌ Только Birthday Builder использует Offer

### После изменений:
- ✅ 100% офферов попадают в фиды (по intent)
- ✅ 30%+ офферов добавляются в My Plan
- ✅ 50%+ офферов участвуют в рекомендациях
- ✅ Offer используется в 3+ местах продукта

---

## 8. РИСКИ И МИТИГАЦИЯ

### Риск 1: Миграция существующих офферов

**Проблема:**
- Есть офферы с kind = EVENT
- Нужно мигрировать в Activity

**Митигация:**
- Создать скрипт миграции
- Проверить все офферы вручную
- Оставить резервную копию

---

### Риск 2: Ломающие изменения в API

**Проблема:**
- Изменение модели ломает существующий API
- Birthday Builder может сломаться

**Митигация:**
- Версионирование API (v1 → v2)
- Поддержка старого API 1-2 месяца
- Постепенный переход

---

### Риск 3: Сложность wizard

**Проблема:**
- Специализированные wizards = больше кода
- Сложнее поддерживать

**Митигация:**
- Использовать shared компоненты
- Единая логика валидации
- Документация для каждого wizard

---

## 9. ЗАКЛЮЧЕНИЕ

### Текущая ситуация:
- ❌ Offer не имеет четкой роли в продукте
- ❌ Дублирование с Event
- ❌ Wizard не соответствует модели
- ❌ Signals не работают
- ❌ Слабая интеграция с продуктом

### После рефакторинга:
- ✅ Offer = услуги, курсы, абонементы (без конкретной даты)
- ✅ Event = события с датой и временем
- ✅ Четкое разделение по intent
- ✅ Signals работают и используются в рекомендациях
- ✅ Offer интегрирован в фиды, My Plan, Birthday Builder

### Ключевые решения:
1. **Убрать Offer.kind = EVENT** → всё с датой = Event
2. **Добавить intent** → разделение фидов
3. **Создать Signal Mapping** → рекомендации
4. **Упростить Wizard** → 5 шагов вместо 7
5. **Интегрировать в продукт** → фиды, My Plan, рекомендации

### Следующие шаги:
1. Обсудить с командой предложенный подход
2. Утвердить приоритеты (Фаза 1 → Фаза 2 → Фаза 3)
3. Создать задачи в трекере
4. Начать с Фазы 1 (критические изменения)

---

**Документ подготовлен:** 5 мая 2026  
**Автор:** Kiro AI  
**Статус:** Готов к обсуждению

