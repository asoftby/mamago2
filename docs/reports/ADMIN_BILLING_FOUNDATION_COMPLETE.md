# Admin Billing Foundation - Complete

> Historical foundation report. See `docs/business/monetization-mvp.md` for
> the authoritative first-PROD rules and enabled financial operations.

## Overview
Реализован полноценный billing foundation для admin части mamaGo 2.0: Prisma схема, seed данные, service layer и admin UI scaffold.

## ✅ Что реализовано

### 1. Prisma Foundation

#### Enums (9 шт)
- `BillingAccountStatus`: ACTIVE, SUSPENDED, CLOSED
- `PlanInterval`: MONTH, YEAR
- `SubscriptionStatus`: ACTIVE, PAST_DUE, CANCELED, EXPIRED, TRIALING
- `BillingTransactionType`: 10 типов (SUBSCRIPTION_CHARGE, DEPOSIT_TOPUP, LEAD_CHARGE, etc.)
- `BillingTransactionStatus`: PENDING, SUCCEEDED, FAILED, CANCELED, REVERSED
- `BillingReferenceType`: NONE, SUBSCRIPTION, PLAN, LEAD, PROMOTION, etc.
- `PaymentMethodType`: CARD, BANK_TRANSFER, CASH, MANUAL

#### Models (7 шт)
1. **BillingAccount** - один на Business
   - depositBalance (snapshot)
   - status, currency
   - thresholds (lowBalanceThreshold, creditLimit)
   - suspension tracking

2. **Plan** - тарифные планы
   - code, name, description
   - price, interval
   - features (maxPlaces, maxOffers, hasPriorityBoost, etc.)
   - visibility flags

3. **Subscription** - подписка бизнеса на план
   - status, billing cycle
   - autoRenew, cancelAtPeriodEnd
   - trial period support

4. **PaymentMethod** - способы оплаты
   - type (CARD, BANK_TRANSFER, etc.)
   - card details (brand, last4, expiry)
   - isDefault, isActive

5. **BillingTransaction** - ledger (source of truth)
   - amount (signed: + credit, - debit)
   - type, status
   - referenceType/referenceId
   - parentTransactionId (для refunds)
   - metadata snapshot

6. **BillingDispute** - foundation для disputes
   - reason, status
   - resolution tracking

7. **Business** - добавлена связь
   - billingAccount relation

#### Migration
- ✅ Created: `20260312225853_add_billing_foundation`
- ✅ Applied successfully

### 2. Seed Data

**File**: `prisma/seed-billing.ts`

Created:
- **4 Plans**:
  - Business Basic (29 BYN/month)
  - Business Pro (59 BYN/month)
  - Business Premium (99 BYN/month)
  - Business Pro Yearly (566 BYN/year)

- **Billing Accounts** для всех существующих businesses
- **Subscriptions** с разными статусами:
  - Active Pro (good balance)
  - Active Basic (low balance)
  - Past Due (suspended)
  - Premium (high balance)
  - Canceled

- **Payment Methods** (Visa/Mastercard)
- **~10 Transactions per business**:
  - Subscription charges
  - Deposit topups
  - Lead charges
  - Promotion charges
  - Refunds
  - Bonus credits

### 3. Service Layer

#### billingAccount.service.ts
- `getBillingAccountByBusinessId()` - получить аккаунт
- `getBillingAccounts()` - список с фильтрами
- `recalculateDepositBalance()` - пересчет из ledger
- `creditBusinessDeposit()` - пополнение
- `debitBusinessDeposit()` - списание
- `suspendBillingAccount()` - приостановка
- `reactivateBillingAccount()` - активация

#### billingTransaction.service.ts
- `getBillingTransactions()` - список с фильтрами
- `createRefund()` - создание возврата

#### billingAdmin.service.ts
- `getBillingOverview()` - KPI для dashboard
- `getBusinessesRequiringAttention()` - проблемные аккаунты

### 4. Admin UI Components

#### BillingKpiCard
**File**: `src/components/admin/billing/BillingKpiCard.tsx`
- Карточка KPI с иконкой
- Поддержка alert state
- Trend indicator

### 5. Admin Pages

#### /admin/billing (Overview)
**File**: `src/app/admin/billing/page.tsx`

Содержит:
- **6 KPI Cards**:
  - Revenue Today
  - Revenue This Month
  - Successful Charges
  - Failed Payments
  - Active Businesses
  - Low Balance (alert)

- **Recent Transactions Table** (10 последних)
- **Businesses Requiring Attention**:
  - Low Balance list
  - Past Due list
- **Quick Links** к другим страницам

## 📁 Структура файлов

### Созданные файлы (8 шт)

```
prisma/
├── seed-billing.ts                                    # Seed данные
└── migrations/
    └── 20260312225853_add_billing_foundation/        # Migration

src/
├── server/services/billing/
│   ├── billingAccount.service.ts                     # Account operations
│   ├── billingTransaction.service.ts                 # Transaction operations
│   └── billingAdmin.service.ts                       # Admin overview
├── components/admin/billing/
│   └── BillingKpiCard.tsx                            # KPI card component
└── app/admin/billing/
    └── page.tsx                                       # Overview page

docs/
└── ADMIN_BILLING_FOUNDATION_COMPLETE.md              # Эта документация
```

### Измененные файлы (1 шт)

```
prisma/schema.prisma                                   # Добавлены billing модели
```

## 🎯 Routes

### Реализованные
1. **`/admin/billing`** - Overview dashboard ✅

### Planned (scaffold needed)
2. `/admin/billing/transactions` - All transactions
3. `/admin/billing/plans` - Plans management
4. `/admin/billing/businesses` - Business balances
5. `/admin/businesses/[id]/billing` - Business billing detail

## 🔧 Что работает

### Полностью функционально
- ✅ Prisma schema и migration
- ✅ Seed данные
- ✅ Service layer (read operations)
- ✅ Admin overview page
- ✅ KPI calculations
- ✅ Recent transactions display
- ✅ Attention lists

### Частично (scaffold)
- ⚠️ Write operations (credit/debit работают, но нет UI)
- ⚠️ Refunds (service готов, UI нужен)
- ⚠️ Suspend/reactivate (service готов, UI нужен)

### Не реализовано (намеренно)
- ❌ Transactions page (нужна отдельная страница)
- ❌ Plans management page
- ❌ Businesses list page
- ❌ Business billing detail page
- ❌ Transaction details drawer
- ❌ Admin actions UI (refund, adjust, etc.)
- ❌ Filters UI
- ❌ Pagination
- ❌ Real payment integration
- ❌ Webhooks
- ❌ Email notifications

## 🌐 Как проверить

### 1. Запустить seed
```bash
npx tsx prisma/seed-billing.ts
```

### 2. Открыть admin billing
```
http://localhost:3000/admin/billing
```

Должны увидеть:
- 6 KPI карточек с реальными данными
- Таблицу последних транзакций
- Списки проблемных аккаунтов
- Quick links

### 3. Проверить данные в БД
```bash
npx prisma studio
```

Открыть:
- BillingAccount (должны быть записи)
- Plan (4 плана)
- Subscription (подписки)
- BillingTransaction (транзакции)

## 📊 Архитектура

### Ledger-Based
- BillingTransaction = source of truth
- depositBalance = snapshot для UI
- Все операции через транзакции
- Parent-child для refunds/corrections

### Separation of Concerns
- Billing отдельно от Business
- Service layer изолирован
- Admin UI отдельно от business UI

### Extensibility
- referenceType/referenceId для связей
- metadata JSON для гибкости
- Enum-based для типов
- Готово для Stripe/банк интеграции

## 🚀 Следующие шаги

### Immediate (для полного MVP)
1. Создать `/admin/billing/transactions` page
2. Создать `/admin/billing/plans` page
3. Создать `/admin/billing/businesses` page
4. Создать `/admin/businesses/[id]/billing` page
5. Добавить transaction details drawer
6. Добавить admin actions UI

### Short-term
1. Filters UI для транзакций
2. Pagination
3. Export transactions
4. Plan CRUD operations
5. Manual adjustments UI
6. Refund UI

### Long-term
1. Stripe integration
2. Webhooks
3. Email notifications
4. Automated billing
5. Invoices
6. Tax handling

## 💡 Ключевые решения

### Почему ledger-based?
- Audit trail из коробки
- Легко пересчитать баланс
- История всех операций
- Поддержка refunds/corrections

### Почему отдельные модели?
- Не захламлять Business
- Легче масштабировать
- Четкая ответственность
- Проще тестировать

### Почему snapshot balance?
- Быстрый UI (не считать каждый раз)
- Можно пересчитать из ledger
- Best of both worlds

### Почему referenceType/referenceId?
- Гибкость связей
- Не жесткие FK
- Легко добавить новые типы
- Metadata для контекста

## ⚠️ Важные заметки

### Безопасность
- Все admin routes требуют ADMIN role
- Service layer изолирован
- Нет прямого доступа к Prisma из UI

### Производительность
- Индексы на ключевые поля
- Pagination готова в service
- Snapshot balance для быстрого UI

### Тестирование
- Seed данные реалистичные
- Разные сценарии (active, suspended, past_due)
- Edge cases (low balance, failed payments)

## 📝 Итог

Реализован **strong foundation** для admin billing:
- ✅ Чистая Prisma схема (7 моделей, 9 enums)
- ✅ Migration применена
- ✅ Seed данные (4 плана, множество транзакций)
- ✅ Service layer (3 сервиса, 10+ методов)
- ✅ Admin overview page (KPI, transactions, attention lists)
- ✅ Reusable UI components
- ✅ Ledger-based architecture
- ✅ Extensible design

**Готово для**:
- Демонстрации stakeholders
- Дальнейшей разработки UI
- Интеграции с платежными системами
- Автоматизации billing процессов

**Не сломано**:
- Существующая архитектура
- Business модель
- Admin layout
- Другие модули

---

**Status**: Foundation Complete ✅
**Next**: Implement remaining admin pages
