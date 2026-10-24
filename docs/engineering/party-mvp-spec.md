# ДЕТСКИЙ ПРАЗДНИК — MVP SPEC (release 15.10.2026)

Статус: v1.2 · 2026-09-26 · база: `dev` @ 99fb5ca
Сводит: аудит 26.09 + COMMERCE SPEC v1 (ветка `docs/commerce-spec-v1-preserved-20260924`) + implementation spec v2 (19.09) + решения 24–26.09.
При конфликте источников действует этот документ.

Изменения v1.2 (review #380): срочная замена со своим порогом lead-time; пакеты матчатся по категориям `PackageComponent`; matching трассируется через общий `RecommendationRun`/`RecommendationExposure` (исключение для ранжирования — на утверждение, §6.1); согласия входят в release gate.

Изменения v1.1: эксклюзивность считается по `BookingUnit` + интервалу, а не по `offer + date`; сторно комиссии и штраф исполнителю — разные сущности; теневой период — 30 состоявшихся праздников или 30.11; «занятые даты» — после запуска.

---

## 0. Рамки (зафиксировано)

1. mamaGo — оркестратор: система подбирает праздник под запрос и отвечает за замену при отказе исполнителя.
2. Деньги клиента mamaGo не принимает. Семья платит каждому исполнителю напрямую. Нет эквайринга, возвратов клиенту, payout.
3. Доход mamaGo — комиссия с баланса бизнеса за подтверждённую бронь. На старте — теневой режим (§7).
4. Дата — параметр заявки. Календарь доступности не строим. Негативный фильтр = подтверждённые брони на `BookingUnit`. Ручные blackout-даты добавляются после запуска в тот же фильтр без переделки matching (§2.3).
5. Эксклюзивность — свойство `BookingUnit` (ресурса бизнеса), а не оффера. Конфликт = тот же unit + пересекающийся интервал + CONFIRMED.
6. `capacityMode = EXCLUSIVE | MULTI` на уровне party-условий оффера. EXCLUSIVE ⇒ у оффера ≥1 unit. Для простого EXCLUSIVE-оффера unit создаётся автоматически.
7. `CHANGES_PROPOSED` — только резерв в enum. Фаза 1 его не создаёт, failover работает только с `NEW`.
8. После `SUBMITTED` параметры Party заморожены. Изменение = отмена + новый DRAFT.
9. RFQ (торт/декор по референсу) — отдельный сценарий, в 15.10 не входит.
10. PACKAGE — готовый пакет с фиксированным составом и ценой, выбирается целиком.
11. Мок-конструктор не полируем. Новый UI — только поверх реального контура.

## 1. Что есть в коде (аудит 26.09)

| Контур | Состояние |
|---|---|
| Публичный конструктор `/[city]/birthday/make` | UI на пустом моке (`birthdayOffers = []`). Submit пишет только в state браузера |
| `/me/birthdays/[id]` | Захардкоженный демо-праздник |
| Party / PartySlot / BookingUnit | В схеме нет |
| Offer PARTY_* | Есть category, partyLocationType, min/maxChildren, occasions, durationMinutes; условия — свободный текст; `pricing-schemas.ts` не используется |
| PackageComponent | Модель есть, write-path в wizard нет |
| BookingRequest | Нет суммы, snapshot, интервала, отмены, замены; `CANCELLED` никто не выставляет; actor только BUSINESS/SYSTEM |
| Billing ledger | Готов (идемпотентность, сторно, rates), но `debitLeadChargeForBookingRequest` нигде не вызывается |
| Telegram | Привязка `link_`-токеном, dev/prod окружения, callback-роутер только для `application:<id>:confirm\|reject` |
| Worker | Есть scheduler и advisory locks (`GlobalLock`) |
| Принятие оферты бизнесом | Не фиксируется нигде |

## 2. Доменная модель

```
Party ─┬─ PartySlot ── BookingRequest[] ──(на confirm)── BookingUnit ── [startAt, endAt)
       │   (роль)       (цепочка замен)                   (ресурс бизнеса)
       └─ snapshot условий на каждой BookingRequest
Offer ── OfferBookingUnit ── BookingUnit
```

- **Party** — праздник семьи.
- **PartySlot** — роль в празднике (площадка, аниматор, торт…). Пакет, закрывающий несколько ролей, бронируется одним слотом-якорем; остальные слоты ссылаются на него через `coveredBySlotId`.
- **BookingRequest** — заявка конкретному бизнесу. На слот может быть несколько заявок подряд (замены), активная — одна.
- **BookingUnit** — то, что физически нельзя продать дважды на одно время: конкретный аниматор, зал, ведущий. Принадлежит бизнесу, может обслуживать несколько офферов (аниматор Анна ведёт и «Супергероев», и «Принцесс»).
- Условия: `BusinessOrderSettings` (defaults) → `OfferPartyTerms` (override, `null` = наследовать) → `BookingTermsSnapshot` (immutable).

Каждая заявка — обычный `BookingRequest`, поэтому сохраняются inbox бизнеса, Direct, уведомления и ledger по `referenceType=REQUEST`.

### 2.1 Новые модели

```prisma
model Party {
  id           String   @id @default(cuid())
  userId       String?            // null для анонимного DRAFT
  planToken    String?  @unique   // httpOnly cookie, мерж в аккаунт при submit
  cityId       String
  childId      String?
  occasion     PartyOccasion @default(BIRTHDAY)
  partyDate    DateTime @db.Date
  startTime    String             // HH:MM, Europe/Minsk
  durationMin  Int
  childAge     Int
  kidsCount    Int
  adultsCount  Int      @default(0)
  locationType PartyLocationType  // ON_SITE = площадка из каталога, OFF_SITE = дом/дача/улица
  districtId   String?
  address      String?            // раскрывается исполнителю только после CONFIRMED
  budgetMin    Decimal? @db.Decimal(10, 2)
  budgetMax    Decimal? @db.Decimal(10, 2)
  autoReplace  Boolean  @default(true)
  status       PartyStatus @default(DRAFT)
  submittedAt  DateTime?
  cancelledAt  DateTime?
  cancelReason String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([userId]) @@index([partyDate]) @@index([status])
}

model PartySlot {
  id              String            @id @default(cuid())
  partyId         String
  category        PartyCategory
  position        Int
  startOffsetMin  Int      @default(0)  // смещение от начала праздника (торт к 13:40)
  durationMin     Int?                  // null = вся длительность Party
  fillMode        PartySlotFillMode @default(EMPTY)
  offerId         String?               // выбранный оффер (fillMode=OFFER)
  coveredBySlotId String?               // слот закрыт пакетом другого слота
  ownTitle        String?               // fillMode=OWN: «торт печёт бабушка»
  ownNote         String?
  status          PartySlotStatus @default(PLANNED)
  @@index([partyId])
}

model BookingUnit {
  id         String   @id @default(cuid())
  businessId String
  title      String                 // «Аниматор Анна», «Зал №2»; для авто-unit = название оффера
  isDefault  Boolean  @default(false) // создан автоматически для простого EXCLUSIVE-оффера
  status     BookingUnitStatus @default(ACTIVE)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@index([businessId, status])
}

model OfferBookingUnit {
  offerId String
  unitId  String
  @@id([offerId, unitId])
  @@index([unitId])
}

model BusinessOrderSettings {
  businessId               String   @id
  acceptsPartyOrders       Boolean  @default(false)
  responseSlaHours         Int      @default(24)
  minLeadTimeHours         Int      @default(72)
  urgentMinLeadTimeHours   Int?     // срочные замены: null = бизнес их не принимает (§5, §6)
  prepaymentType           PrepaymentType @default(NONE)
  prepaymentValue          Decimal? @db.Decimal(10, 2)
  freeCancellationHours    Int      @default(168)
  cancellationNote         String?
  allowReplacementByMamago Boolean  @default(true)
  version                  Int      @default(1)
  updatedAt                DateTime @updatedAt
}

model OfferPartyTerms {
  offerId               String   @id
  capacityMode          CapacityMode @default(MULTI)
  pricingUnit           PartyPricingUnit @default(PER_EVENT)
  basePrice             Decimal  @db.Decimal(10, 2)
  includedChildren      Int?
  extraChildPrice       Decimal? @db.Decimal(10, 2)
  extraHourPrice        Decimal? @db.Decimal(10, 2)
  offSiteSurcharge      Decimal? @db.Decimal(10, 2)
  bufferMin             Int      @default(0)   // уборка/дорога после праздника, расширяет интервал unit
  serviceDistrictIds    String[] @default([])  // пусто = весь город
  minLeadTimeHours      Int?
  prepaymentType        PrepaymentType?
  prepaymentValue       Decimal? @db.Decimal(10, 2)
  freeCancellationHours Int?
  cancellationNote      String?
  updatedAt             DateTime @updatedAt
}

model BookingTermsSnapshot {
  id                      String @id @default(cuid())
  bookingId               String
  version                 Int
  status                  TermsSnapshotStatus @default(PROPOSED)
  terms                   Json
  businessSettingsVersion Int
  total                   Decimal   @db.Decimal(10, 2)
  currency                String    @default("BYN")
  acceptedByCustomerAt    DateTime? // = submit
  acceptedByBusinessAt    DateTime? // = confirm
  createdAt               DateTime  @default(now())
  @@unique([bookingId, version])
}

model BookingPriceLine {
  id         String  @id @default(cuid())
  snapshotId String
  type       PriceLineType
  label      String
  quantity   Decimal @db.Decimal(10, 2) @default(1)
  unitAmount Decimal @db.Decimal(10, 2)
  amount     Decimal @db.Decimal(10, 2)
  position   Int
}

model BusinessTermsAcceptance {
  id               String   @id @default(cuid())
  businessId       String
  documentType     String   // B2B_PUBLIC_OFFER | PARTY_TERMS
  documentVersion  String
  acceptedAt       DateTime @default(now())
  acceptedByUserId String
  @@index([businessId, documentType])
}

/// Комиссия за бронь. Плата за сделку — не штраф.
model PartyCommission {
  id                    String   @id @default(cuid())
  bookingId             String   @unique
  businessId            String
  mode                  PartyBillingMode      // SHADOW | LIVE на момент начисления
  baseAmount            Decimal  @db.Decimal(10, 2)  // snapshot.total
  rate                  Decimal  @db.Decimal(6, 4)
  amount                Decimal  @db.Decimal(10, 2)
  status                PartyCommissionStatus @default(ACCRUED)
  accruedAt             DateTime @default(now())
  reversedAt            DateTime?
  reversalReason        String?               // CUSTOMER_CANCELLED | SYSTEM_CANCELLED | VENDOR_CANCELLED | VENDOR_DECLINED
  chargeTransactionId   String?  @unique      // только LIVE
  reversalTransactionId String?  @unique      // только LIVE
  @@index([businessId, status])
}

/// Санкция исполнителю. Отдельное основание, отдельный документ, отдельная транзакция.
model VendorPenalty {
  id            String   @id @default(cuid())
  businessId    String
  bookingId     String
  reasonCode    String   // LATE_CANCELLATION | NO_SHOW | PLATFORM_BYPASS
  mode          PartyBillingMode
  amount        Decimal  @db.Decimal(10, 2)
  status        VendorPenaltyStatus @default(ACCRUED)
  note          String?
  transactionId String?  @unique               // только LIVE
  createdAt     DateTime @default(now())
  resolvedAt    DateTime?
  @@unique([bookingId, reasonCode])
  @@index([businessId, status])
}
```

### 2.2 Изменения существующих моделей

- `BookingRequest` +:
  - `partyId`, `partySlotId`, `replacesBookingId @unique` (цепочка замен);
  - `startAt`, `endAt` (timestamptz) — интервал работы исполнителя с учётом `bufferMin`;
  - `bookingUnitId` — назначается при confirm, `null` для MULTI;
  - `responseDeadlineAt`;
  - `cancelledAt`, `cancelledBy BookingActivityActorType?`, `cancelReasonCode`, `cancelReasonText`, `cancelledWithinFreeWindow`.
- Инварианты на уровне БД (raw SQL в миграции PR 2):
  - partial unique: одна заявка в `NEW | CONFIRMED` на `partySlotId`;
  - exclusion constraint (`btree_gist`): `EXCLUDE USING gist ("bookingUnitId" WITH =, tstzrange("startAt","endAt") WITH &&) WHERE ("bookingUnitId" IS NOT NULL AND status IN ('CONFIRMED','COMPLETED'))`. Это последняя линия защиты от двойной брони, даже если сервисный слой ошибётся.
- Enum-расширения (PR 1):
  - `BookingStatus` + `EXPIRED`, `CHANGES_PROPOSED` (резерв);
  - `BookingActivityActorType` + `CUSTOMER`, `MAMAGO`;
  - `BookingActivityType` + `TERMS_PROPOSED`, `TERMS_ACCEPTED`, `UNIT_ASSIGNED`, `CANCELLED`, `EXPIRED`, `REPLACED`;
  - `BillingActionType` + `PARTY_BOOKING_CONFIRMED`;
  - `BillingTransactionType` + `COMMISSION_REVERSAL`, `PENALTY_CHARGE`;
  - `BillingReferenceType` + `PARTY_COMMISSION`, `VENDOR_PENALTY`.
- `PackageComponent`: в MVP пишутся только `category`, `title`, `position`.
- Миграции: PR 1 — `ALTER TYPE ... ADD VALUE` и `CREATE TYPE` отдельными файлами, без таблиц. `migrate diff --script` → review → apply.

### 2.3 Blackout после запуска

`BookingUnitBlackout(unitId, startAt, endAt, source: MANUAL | TELEGRAM)`. Negative filter matching = `CONFIRMED`-брони ∪ blackout по unit. Контракт matching не меняется, меняется одна функция `isUnitBusy(unitId, interval)`.

## 3. Правила домена

1. **Resolve terms** — чистая функция `resolveEffectivePartyTerms(settings, offerTerms)`. Unit-тесты.
2. **Quote** — `quotePartyOffer(offer, party, slot)` → `lines[] + total`. Оффер не проходит, если нарушены minLeadTime, min/maxChildren, формат локации, район выезда.
3. **Интервал** — `startAt = partyDate + startTime + slot.startOffsetMin`, `endAt = startAt + (slot.durationMin ?? party.durationMin) + bufferMin`, TZ Europe/Minsk.
4. **Submit Party** — одна транзакция: Party → SUBMITTED; на каждый слот с `fillMode=OFFER` и без `coveredBySlotId` — `BookingRequest(NEW)` + snapshot v1 (`acceptedByCustomerAt = now`) + `responseDeadlineAt` по SLA. Слоты → REQUESTED. Нужны логин и согласие на передачу данных исполнителям. `NEW` unit не занимает: несколько семей могут ждать ответа одного исполнителя.
5. **Confirm бизнесом** — только через `confirmPartyBooking()` (§4). **Это момент сделки.** Второго подтверждения клиентом нет.
6. **Decline бизнесом** — причина из списка → слот в REPLACING (§5).
7. **Expire** — worker: `NEW` и `now > responseDeadlineAt` → EXPIRED → REPLACING. Подтверждение после EXPIRED отклоняется.
8. **Отмена бизнесом после CONFIRMED** — reason обязателен, слот → REPLACING, комиссия сторнируется, штраф — отдельной записью `VendorPenalty` (§7).
9. **Отмена клиентом** — Party → CANCELLED, все активные брони → CANCELLED (`cancelledBy=CUSTOMER`), подтверждённым исполнителям уведомление, комиссии сторнируются. `cancelledWithinFreeWindow` считается по snapshot (для предоплаты между семьёй и исполнителем, mamaGo её не касается).
10. **Party-статус** — вычисляемый: CONFIRMED, когда все слоты с `fillMode=OFFER` без `coveredBySlotId` в CONFIRMED.
11. **Gate выдачи в конструкторе:** `acceptsPartyOrders && Offer.PUBLISHED && OfferPartyTerms != null && (MULTI || ≥1 ACTIVE unit) && принята актуальная PARTY_TERMS && есть канал ответа (TG или email)`. Проверка баланса — за флагом `PARTY_DEPOSIT_GATE` (выключен до выхода из теневого режима).

## 4. `confirmPartyBooking(bookingId, actor)` — единственный путь в CONFIRMED

1. Прочитать бронь, её оффер и список `ACTIVE`-units оффера.
2. `pg_advisory_xact_lock` по каждому unit оффера (в отсортированном порядке id — без дедлоков). Для MULTI — lock по bookingId.
3. Перечитать бронь: статус `NEW`, дедлайн не истёк, актор — член бизнеса брони.
4. EXCLUSIVE: выбрать первый unit, на котором нет `CONFIRMED | COMPLETED`-брони, пересекающейся с `[startAt, endAt)` (после запуска — и blackout). Нет свободного → отказ «у вас уже подтверждён праздник на это время», бронь остаётся `NEW`. Если бизнес указал unit явно — проверять только его.
5. В одной транзакции: бронь → CONFIRMED + `bookingUnitId`, snapshot → ACCEPTED, слот → CONFIRMED, `BookingActivity` (`STATUS_CHANGED`, `UNIT_ASSIGNED`), `PartyCommission` (§7). Идемпотентно по `bookingId`.
6. Exclusion constraint из §2.2 ловит всё, что прошло мимо сервиса; нарушение → тот же отказ.

Тот же путь используют кабинет, Telegram, email-ссылки и (Фаза 2) binding selection RFQ. Прямой `update` статуса на CONFIRMED для party-броней запрещён сервисным guard + тестом.

## 5. Замена

Триггеры: decline, expire, отмена бизнесом после CONFIRMED.

1. Слот → REPLACING. Matching `purpose=REPLACEMENT`, `exclude` = все бизнесы, уже задействованные в этом слоте.
2. Клиенту: уведомление + экран «исполнитель не сможет, вот 3–5 вариантов». Выбор = новая `BookingRequest(NEW)` с `replacesBookingId` и тем же `partySlotId`. Новый исполнитель подтверждает сам.
3. SLA замены: `min(responseSlaHours, 2ч)`, если до праздника < 72ч.
3a. Lead-time для замены — отдельный порог: `urgentMinLeadTimeHours` бизнеса. Бизнесы без него (`null`) в срочной замене не участвуют, если до праздника меньше их обычного `minLeadTimeHours`. Онбординг просит каждого исполнителя явно указать, берёт ли он срочные заказы.
4. Клиент не выбрал за 12ч (2ч при < 72ч до праздника) и `Party.autoReplace = true` → система сама отправляет top-1.
5. Кандидатов нет или вторая замена сорвалась → слот UNFILLED, эскалация в Operations Center + TG админу, ручной поиск. Не нашли — честное сообщение клиенту, слот можно перевести в OWN.
6. Площадка — якорь. Если отменяет площадка, остальные слоты не отменяются, клиенту приоритетно предлагается замена площадки.

## 6. Matching (MVP)

Read-only сервис, `purpose = ASSEMBLY | REPLACEMENT`.

**Hard filters:**
- gate §3.11;
- **категория:** `PARTY_SERVICE` — `Offer.category = slot.category`; `PARTY_PACKAGE` (у него `Offer.category = null` по канону) — `slot.category ∈ categories(PackageComponent)`. Пакет становится якорем слота, остальные его категории закрывают слоты через `coveredBySlotId`;
- город, для OFF_SITE — район в `serviceDistrictIds`;
- возраст · вместимость · формат локации;
- **lead-time:** `ASSEMBLY` — `startAt − now ≥ minLeadTimeHours`; `REPLACEMENT` — `startAt − now ≥ min(minLeadTimeHours, urgentMinLeadTimeHours ?? minLeadTimeHours)` (§5.3a);
- EXCLUSIVE: нет ни одного свободного unit на интервал (`isUnitBusy`) → исключить;
- цена > бюджет слота × 1.4 → исключить (для пакета — бюджет суммы покрываемых слотов);
- `exclude`.

**Ranking:** `fit 0.30 · priceFit 0.30 · themeMatch 0.20 · contentQuality 0.15 · recentActivity 0.05`. `reliability` добавляется после 30+ заявок. `priceFit` — близость к бюджету, а не «дешевле = лучше».

**ASSEMBLY:** top-1 на слот. Пакет, закрывающий несколько слотов, конкурирует с суммой отдельных офферов по этим слотам.
**REPLACEMENT:** 3–5 кандидатов.

### 6.1 Связь с общим фундаментом рекомендаций (`docs/architecture/recommendation-data-foundation.md`)

**Трассировка — всегда через общий фундамент, без параллельного лога:**
- новая поверхность `RecommendationSurface.PARTY_BUILDER`;
- каждый ASSEMBLY и REPLACEMENT пишет `RecommendationRun` (`algorithmVersion = party-assembly-v1`, context: partyId, slot, purpose) и `RecommendationExposure` на возвращённые офферы;
- выбор клиентом и подтверждение исполнителем — обычные `UserEvent`, атрибутируемые через `RecommendationOutcome`;
- `Party.assemblyLog` и отдельный `MatchRun` не вводятся.

**Ранжирование — задокументированное исключение (ТРЕБУЕТ УТВЕРЖДЕНИЯ).** Основание по правилу фундамента («genuinely different entities/objectives»): задача конструктора — назначение исполнителя под жёсткие ограничения одного праздника (дата, интервал, ёмкость unit, бюджет, состав пакета), а не вовлечённость в ленту событий `engagement-freshness-v1`. Границы исключения:
- свои только hard filters и сигналы, которых нет в общем пайплайне: `fit`, `priceFit`, доступность unit;
- `themeMatch` не вводит своих весов поведения: берётся из `UserBehaviorProfile` / `behaviorSignalWeights.ts` и профиля ребёнка;
- собственных behavior-весов и отдельной истины обратной связи нет;
- веса версионируются через `algorithmVersion`, surface-ограничения (кол-во кандидатов, квоты) — через `RecommendationSurfacePolicy`.

Golden tests на 15–20 реальных офферах.

## 7. Биллинг

### 7.1 Две разные операции

| | Комиссия (`PartyCommission`) | Штраф (`VendorPenalty`) |
|---|---|---|
| Основание | подтверждённая сделка | нарушение исполнителем условий оферты |
| Когда | при `confirmPartyBooking` | при поздней отмене, неявке, обходе платформы |
| Отмена | сторно, если сделки не случилось | снятие (`WAIVED`) решением mamaGo |
| Ledger (LIVE) | `LEAD_CHARGE` / `COMMISSION_REVERSAL`, ref `PARTY_COMMISSION` | `PENALTY_CHARGE`, ref `VENDOR_PENALTY` |
| Документ | ежемесячный акт на услуги платформы | отдельная строка «неустойка по п. X оферты» |

### 7.2 Сторно комиссии

Комиссия сторнируется всегда, когда сделка не состоялась:
- клиент отменил → `CUSTOMER_CANCELLED`;
- система или mamaGo отменили → `SYSTEM_CANCELLED`;
- исполнитель отменил после CONFIRMED → `VENDOR_CANCELLED` (плюс отдельный штраф по правилам оферты);
- `COMPLETED` → комиссия окончательная.

Сторно идемпотентно (`PartyCommission.status`, ключ ledger `party-commission-reversal:{commissionId}`).

### 7.3 Теневой режим

- Флаг `PARTY_BILLING_MODE = SHADOW | LIVE`, по умолчанию SHADOW. В SHADOW `PartyCommission` и `VendorPenalty` пишутся с `mode=SHADOW`, ledger не трогается, баланс не двигается. Бизнес видит в кабинете «было бы списано».
- Выход из SHADOW **не автоматический**. Условие для решения: 30 праздников в статусе `COMPLETED` **или** 30.11.2026 — что наступит раньше. Operations Center поднимает сигнал, решение принимает Алексей, флаг переключается вручную.
- Записи, начисленные в SHADOW, при переключении в LIVE не списываются задним числом.
- Ставка — только конфиг (`BillingActionRate` для `PARTY_BOOKING_CONFIRMED`). Код от её значения не зависит.

## 8. Telegram

1. **Привязка** — существующий `link_`-токен, кнопка в кабинете «Подключить Telegram». Уведомление получает каждый член бизнеса с подключённым TG.
2. **Роутер callback** — обобщить: `{domain}:{id}:{action}`. Новый домен `pb` (party booking): `pb:<bookingId>:c`, `pb:<bookingId>:d`, `pb:<bookingId>:d:<reasonCode>`. Проверки: активная связка, членство в бизнесе брони, идемпотентность, после действия — `editMessageText`.
3. **Новая заявка:** категория, дата, интервал, район (без адреса), возраст и число детей, оффер, сумма по snapshot, комментарий, дедлайн ответа. Кнопки: ✅ Подтверждаю / ❌ Не могу → причины: «занят», «не подходит формат», «далеко», «другое». При нескольких units — выбор unit («Кто проведёт?») или «любой свободный».
4. **После подтверждения:** в том же сообщении контакт клиента и адрес.
5. **Напоминания:** за 30 мин до дедлайна ответа; за день до праздника (исполнителю и клиенту); после праздника исполнителю «Праздник состоялся?» Да / Нет → `COMPLETED` или разбор.
6. **Без TG** — email с теми же действиями по подписанной ссылке + кабинет.
7. **Занятые даты** — после запуска (§2.3): кнопка «📅 Занятые даты» → календарь месяца → `BookingUnitBlackout(source=TELEGRAM)`.

## 9. Юридический контур

1. **B2B: приложение к публичной оферте «Условия конструктора праздников»**: статус информационного посредника; SLA ответа; комиссия, момент начисления и сторно; теневой период; согласие на замену mamaGo; неустойка за позднюю отмену, неявку и обход платформы — отдельным пунктом, не через комиссию; заверение о законности деятельности (ИП / ремесленник / юрлицо) и безопасности услуг для детей; обработка ПД клиентов только для исполнения заказа. Акцепт — чекбокс при включении `acceptsPartyOrders`, фиксация в `BusinessTermsAcceptance`.
2. **B2C: соглашение + «Гарантия праздника»**: mamaGo подбирает исполнителей и организует замену, но не является исполнителем, не отвечает за качество услуги и расчёты с исполнителем, денег семьи не принимает.
3. **Согласия при submit:** передача контактов и данных о празднике выбранным исполнителям; данные ребёнка (имя, возраст) — согласие родителя.
4. Прогнать через юриста до 10.10: формулировки §9.1–9.2 и соответствие деятельности ИП.

## 10. Скоуп и порядок

### MUST до 15.10

| PR | Содержимое | Зависит от |
|---|---|---|
| 1 | Enum foundation: `ALTER TYPE ADD VALUE` + `CREATE TYPE`, без таблиц. Метки новых значений в exhaustive-картах UI | — |
| 2 | Модели §2.1, поля §2.2, relations, indexes, partial unique, exclusion constraint (`btree_gist`); backfill: `OfferPartyTerms(capacityMode=EXCLUSIVE)` + default unit для площадок | 1 |
| 3 | Domain: resolve terms, quote, интервал, `confirmPartyBooking` + тест на гонку двух confirm | 2 |
| 4 | Кабинет: «Заказы и условия» (7 полей), units, wizard-шаг «Цена и условия» для PARTY_*, состав пакета (категории), принятие PARTY_TERMS | 2 |
| 5 | Matching service + golden tests; трассировка через `RecommendationRun`/`Exposure` (surface `PARTY_BUILDER`) | 3 |
| 6 | Builder на реальных данных: DRAFT с `planToken`, автосборка, замена в слоте, submit → Party; `/me/birthdays` на реальных данных. **Согласия §9.3 при submit (обязательны, без них submit невозможен).** За флагом `PARTY_BUILDER` | 3, 5 |
| 7 | Действия бизнеса: кабинет + TG-роутер + email-ссылки; отмена клиентом | 3 |
| 8 | Worker: expire, replacement, эскалация, напоминания | 5, 7 |
| 9 | Теневой биллинг: `PartyCommission`, сторно, `VendorPenalty`, блок в кабинете бизнеса, сигнал выхода из SHADOW | 3 |
| 10 | Юр. страницы (B2C-соглашение, «Гарантия праздника», приложение к B2B-оферте), удаление мок-слоя | 6 |

Release gate: флаг `PARTY_BUILDER` включается только когда в проде PR 6 (включая согласия), 7, 8 **и 10** (юридические страницы, на которые ссылаются согласия). Без согласий на передачу контактов и данных ребёнка submit не открывается.
Параллельно, вне кода: онбординг исполнителей — минимум 5 площадок, 8 аниматоров/ведущих, 5 шоу, 3 торта, 3 декора, 3 фото в Минске с заполненными условиями.

### Сразу после запуска
Занятые даты в TG (`BookingUnitBlackout`) · reliability score · отзывы после праздника · воронка конструктора в Operations Center (DRAFT → SUBMITTED, доля слотов, закрытых без замены) · решение о выходе из SHADOW.

### Phase 2
RFQ (торт/декор по референсу) + binding selection через `confirmPartyBooking` · `CHANGES_PROPOSED` / встречное предложение · опциональные компоненты пакета и `priceDelta` · серверный движок сценария дня · платежи через mamaGo (checkout, сплит, агентская схема).

## 11. Решения и открытые вопросы

Закрыто 26.09:
- Занятые даты — после запуска; модель blackout заложена (§2.3).
- Теневой период — 30 состоявшихся праздников или 30.11.2026, что раньше; переключение ручное (§7.3).
- Комиссия сторнируется при любой несостоявшейся сделке; штраф — отдельная сущность (§7.1–7.2).
- Эксклюзивность по `BookingUnit` + интервалу (§0.5, §4).

Открыто:
0. **Исключение для ранжирования конструктора (§6.1)** — утвердить или отправить matching целиком в общий пайплайн.
1. **Ставка комиссии** — нужна для текста оферты до 10.10, на код не влияет.
2. **Размер неустойки** за позднюю отмену и порог «поздней» — для оферты. Предложение из обсуждения 24.09: 10% от snapshot, 20% при отмене < 48ч.
3. **Gate депозита для обычных броней** (не праздников) — вне скоупа 15.10?
