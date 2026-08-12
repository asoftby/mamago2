# Business Billing UI/UX Prototype - Complete

> Historical implementation report. The canonical first-PROD model is
> `docs/business/monetization-mvp.md`; mock plans, paid leads and online top-up
> described below are not current monetization behavior.

## Overview
Реализован первый слой биллинга для business-кабинета mamaGo: UI/UX прототип с мок-данными для тестирования визуала и пользовательского опыта. Без реальной платежной логики и интеграций.

## Что реализовано

### 1. Мок-данные
**Файл**: `src/lib/mocks/businessBilling.ts`

Содержит:
- `mockCurrentPlan` - текущий тарифный план (Business Pro, 59 BYN/мес)
- `mockPaymentMethod` - способ оплаты (Visa **** 4242)
- `mockDeposit` - данные депозита (баланс 84.50 BYN, потрачено 36.20 BYN)
- `mockUsageStats` - статистика использования депозита
- `mockPlanHistory` - история продлений тарифа (4 записи)
- `mockTransactions` - история транзакций (15 записей разных типов)

Типы транзакций:
- `plan_renewal` - Продление тарифа
- `deposit_topup` - Пополнение депозита
- `lead_charge` - Списание за лид
- `promotion_charge` - Списание за продвижение
- `refund` - Возврат
- `adjustment` - Корректировка

Статусы:
- `completed` - Выполнено
- `pending` - В обработке
- `failed` - Ошибка
- `refunded` - Возвращено

Helper функции:
- `getTransactionTypeLabel()` - получить русское название типа
- `getTransactionStatusLabel()` - получить русское название статуса
- `formatCurrency()` - форматирование суммы
- `formatDate()` - форматирование даты
- `formatDateTime()` - форматирование даты и времени

### 2. Компоненты

#### BillingPlanWidget
**Файл**: `src/components/business/billing/BillingPlanWidget.tsx`

Компактный виджет тарифного плана для dashboard:
- Название плана и статус (активен/заканчивается/неактивен)
- Цена и период (месяц/год)
- Дата следующего списания
- Индикатор автопродления
- CTA кнопка "Управлять тарифом" → `/business/billing/plan`

Визуал:
- Иконка CreditCard в синем круге
- Цветные бадж статуса (зеленый/желтый/серый)
- Крупная цена (3xl font)
- Hover эффект на карточке

#### BillingDepositWidget
**Файл**: `src/components/business/billing/BillingDepositWidget.tsx`

Компактный виджет депозита для dashboard:
- Текущий баланс
- Потрачено за месяц
- Warning при низком балансе (< 20 BYN)
- Subtitle о назначении депозита
- CTA кнопка "Пополнить депозит" / "Открыть депозит" → `/business/billing/deposit`

Визуал:
- Иконка Wallet (зеленая при норме, оранжевая при низком балансе)
- Оранжевый бадж "Низкий баланс" при необходимости
- Цвет баланса меняется на оранжевый при низком значении
- Иконка TrendingDown для статистики месяца

#### TransactionStatusBadge
**Файл**: `src/components/business/billing/TransactionStatusBadge.tsx`

Переиспользуемый бадж статуса транзакции:
- Размеры: `sm` (по умолчанию) и `md`
- Цветовая кодировка:
  - Зеленый - completed
  - Желтый - pending
  - Красный - failed
  - Серый - refunded
- Иконки для каждого статуса
- Rounded pill дизайн

#### BillingStatCard
**Файл**: `src/components/business/billing/BillingStatCard.tsx`

Карточка статистики для страницы депозита:
- Иконка в сером круге
- Label (название метрики)
- Value (крупное значение)
- Subtitle (дополнительная информация)
- Опциональный trend indicator

### 3. Страницы

#### Dashboard с виджетами
**Файл**: `src/app/business/(protected)/dashboard/page.tsx`

Обновлен dashboard:
- Добавлены billing виджеты в grid 2 колонки (desktop) / 1 колонка (mobile)
- Виджеты размещены после заголовка, перед Improvement Requests
- Импорты компонентов BillingPlanWidget и BillingDepositWidget

#### Страница тарифного плана
**Файл**: `src/app/business/(protected)/billing/plan/page.tsx`
**URL**: `/business/billing/plan`

Содержимое:
1. **Header** - "Тариф и подписка"
2. **Current Plan Card** - текущий тариф
   - Название, статус, цена, период
   - Дата следующего списания
   - Автопродление
   - Способ оплаты (Visa **** 4242)
   - Кнопки: "Изменить тариф", "Обновить способ оплаты"
3. **Included Features** - возможности тарифа
   - 8 фич с иконками CheckCircle
   - Grid 2 колонки
4. **Plan History** - история продлений
   - Таблица с датой, операцией, суммой, статусом
   - 4 записи истории
5. **Info Block** - информационный блок
   - Дата следующего списания
   - Возможность изменить тариф

Визуал:
- Чистый white background для карточек
- Синий акцент для иконок
- Зеленые CheckCircle для фич
- Таблица с hover эффектом
- Синий info блок внизу

#### Страница депозита
**Файл**: `src/app/business/(protected)/billing/deposit/page.tsx`
**URL**: `/business/billing/deposit`

Содержимое:
1. **Header** - "Депозит"
2. **Balance Hero Card** - главная карточка баланса
   - Крупный баланс (4xl font)
   - Gradient background (зеленый при норме, оранжевый при низком)
   - Warning бадж при низком балансе
   - Рекомендация пополнения
   - Кнопка "Пополнить депозит"
3. **Month Usage Summary** - статистика за месяц
   - 4 stat карточки в grid:
     - Потрачено
     - Количество списаний
     - Средний чек
     - Последнее списание
4. **Recent Usage** - последние операции
   - 10 последних транзакций по депозиту
   - Тип, описание, дата, сумма, статус
   - Hover эффект на карточках
5. **Rules/Info Card** - правила и информация
   - За что списывается депозит
   - Что произойдет при низком балансе
   - Ссылка на полную историю

Визуал:
- Gradient hero card (зеленый/оранжевый)
- Grid stat карточек
- Список транзакций с border
- Синий info блок

#### Страница истории транзакций
**Файл**: `src/app/business/(protected)/billing/transactions/page.tsx`
**URL**: `/business/billing/transactions`

Содержимое:
1. **Header** - "История операций"
2. **Filters** - фильтры (UI-only, client-side)
   - Тип операции (dropdown)
   - Статус (dropdown)
   - Счетчик найденных записей
3. **Transactions Table** - таблица транзакций
   - Колонки: Дата, Тип, Описание, Сумма, Статус, Действие
   - 15 записей мок-данных
   - Hover эффект на строках
   - Expandable rows (клик по строке)
4. **Transaction Details** - детали при раскрытии
   - ID транзакции
   - Дата и время
   - Сумма
   - Метод оплаты
   - Связанная сущность (место/событие/предложение)
   - Кнопка перехода к сущности

Визуал:
- Фильтры в белой карточке
- Таблица с серым header
- Expandable rows с анимацией
- Детали в bordered карточке
- Цветовая кодировка сумм (зеленый для пополнений)

Особенности:
- Client component ("use client")
- useState для фильтров и раскрытия строк
- Фильтрация работает на клиенте
- Smooth transitions

#### Billing Layout с табами
**Файл**: `src/app/business/(protected)/billing/layout.tsx`

Общий layout для всех billing страниц:
- Табы навигации: Тариф, Депозит, История операций
- Active state с border-bottom
- Hover эффекты
- Client component для usePathname

### 4. Навигация

#### Sidebar обновлен
**Файл**: `src/components/business/layout/BusinessSidebar.tsx`

Добавлен пункт:
- "Billing" с иконкой CreditCard
- Ссылка на `/business/billing/plan`
- Active state для всех `/business/billing/*` страниц

#### Внутренняя навигация
- Dashboard виджеты → страницы billing
- Табы между billing страницами
- Ссылка из депозита на транзакции
- Кнопки "Изменить тариф", "Обновить способ оплаты" (пока без действия)

## Структура файлов

```
src/
├── lib/
│   └── mocks/
│       └── businessBilling.ts          # Мок-данные
├── components/
│   └── business/
│       ├── billing/
│       │   ├── BillingPlanWidget.tsx   # Виджет тарифа
│       │   ├── BillingDepositWidget.tsx # Виджет депозита
│       │   ├── TransactionStatusBadge.tsx # Бадж статуса
│       │   └── BillingStatCard.tsx     # Карточка статистики
│       └── layout/
│           └── BusinessSidebar.tsx     # Обновлен (добавлен Billing)
└── app/
    └── business/
        └── (protected)/
            ├── dashboard/
            │   └── page.tsx            # Обновлен (добавлены виджеты)
            └── billing/
                ├── layout.tsx          # Layout с табами
                ├── plan/
                │   └── page.tsx        # Страница тарифа
                ├── deposit/
                │   └── page.tsx        # Страница депозита
                └── transactions/
                    └── page.tsx        # Страница транзакций
```

## Добавленные routes

1. `/business/billing/plan` - Страница тарифного плана
2. `/business/billing/deposit` - Страница депозита
3. `/business/billing/transactions` - Страница истории операций

## Как проверить

### 1. Dashboard
Откройте: `http://localhost:3000/business/dashboard`

Должны увидеть:
- 2 виджета в ряд (desktop) или друг под другом (mobile)
- Виджет "Business Pro" с ценой 59 BYN/мес
- Виджет "Депозит" с балансом 84.50 BYN и оранжевым warning "Низкий баланс"
- Кнопки ведут на соответствующие страницы

### 2. Страница тарифа
Откройте: `http://localhost:3000/business/billing/plan`

Должны увидеть:
- Табы навигации вверху (Тариф активен)
- Карточку текущего тарифа Business Pro
- Способ оплаты Visa **** 4242
- Список из 8 возможностей тарифа
- Таблицу истории продлений (4 записи)
- Синий info блок внизу

### 3. Страница депозита
Откройте: `http://localhost:3000/business/billing/deposit`

Должны увидеть:
- Табы навигации (Депозит активен)
- Оранжевый gradient hero card с балансом 84.50 BYN
- Warning "Низкий баланс" и рекомендацию пополнить
- 4 stat карточки со статистикой месяца
- Список последних 10 операций по депозиту
- Синий info блок с правилами

### 4. Страница транзакций
Откройте: `http://localhost:3000/business/billing/transactions`

Должны увидеть:
- Табы навигации (История операций активна)
- Фильтры по типу и статусу
- Таблицу с 15 транзакциями
- Возможность раскрыть детали (клик по строке)
- Работающие фильтры (меняют список)

### 5. Sidebar
На любой странице business кабинета:
- Пункт "Billing" с иконкой кредитной карты
- Active state на billing страницах

## Дизайн и UX

### Цветовая схема
- **Primary**: Gray-900 (кнопки, заголовки)
- **Success**: Green-600 (положительные статусы, пополнения)
- **Warning**: Orange-600 (низкий баланс, предупреждения)
- **Info**: Blue-600 (информационные блоки)
- **Error**: Red-600 (ошибки, отклонения)
- **Neutral**: Gray-50/100/200 (фоны, borders)

### Типографика
- **Page titles**: 3xl font-bold
- **Card titles**: xl font-semibold
- **Stats values**: 2xl-4xl font-bold
- **Body text**: sm-base
- **Labels**: sm text-gray-600

### Spacing
- **Page padding**: p-8 (в BusinessShell)
- **Card padding**: p-6
- **Section gaps**: space-y-6
- **Grid gaps**: gap-4

### Компоненты
- **Cards**: white bg, rounded-lg, shadow
- **Buttons**: rounded-lg, font-medium, transition-colors
- **Badges**: rounded-full, border, small padding
- **Tables**: hover:bg-gray-50, border-b
- **Tabs**: border-b-2, active state

### Responsive
- **Desktop**: 2 колонки для виджетов, 4 колонки для stats
- **Mobile**: 1 колонка, stack layout
- **Breakpoint**: md (768px)

## Технические детали

### Server vs Client Components
- **Server**: plan page, deposit page (используют getCurrentUser)
- **Client**: transactions page (фильтры, state), billing layout (tabs), виджеты (ссылки)

### Мок-данные
- Все данные статичные, в памяти
- Нет API calls
- Нет database queries
- Нет реальных платежей

### Типизация
- TypeScript типы для всех данных
- Enum-like types для статусов
- Интерфейсы для всех структур данных

### Не реализовано (намеренно)
- ❌ Реальные платежи
- ❌ Stripe/банк интеграция
- ❌ Backend API для billing
- ❌ Database схема для billing
- ❌ Реальное пополнение депозита
- ❌ Реальное изменение тарифа
- ❌ Email уведомления
- ❌ Webhooks
- ❌ Экспорт транзакций
- ❌ Фильтры по датам (только по типу/статусу)

## Следующие шаги (для будущего)

### Backend интеграция
1. Создать Prisma схему для billing
2. Создать API routes для операций
3. Интегрировать Stripe/банк
4. Реализовать webhooks
5. Добавить email уведомления

### Функциональность
1. Реальное пополнение депозита
2. Изменение тарифа
3. Обновление способа оплаты
4. Отключение автопродления
5. Экспорт истории транзакций
6. Фильтры по датам
7. Pagination для транзакций

### UX улучшения
1. Loading states
2. Error handling
3. Success notifications
4. Confirmation modals
5. Empty states
6. Skeleton loaders

## Архитектурные решения

### Почему мок-данные в отдельном файле?
- Легко заменить на реальные API calls
- Переиспользование в разных компонентах
- Централизованное управление тестовыми данными
- Типизация в одном месте

### Почему отдельные компоненты?
- Переиспользование (виджеты, бадж, stat card)
- Легче тестировать
- Проще поддерживать
- Можно использовать в других местах

### Почему layout с табами?
- Единая навигация между billing страницами
- Не нужно дублировать табы на каждой странице
- Consistent UX
- Легко добавить новые табы

### Почему client component для транзакций?
- Фильтры требуют state
- Expandable rows требуют state
- Нет смысла делать server-side для мок-данных
- Быстрее работает на клиенте

## Итог

Реализован полноценный UI/UX прототип биллинга для business кабинета:
- ✅ 2 виджета на dashboard
- ✅ 3 детальные страницы
- ✅ Качественные мок-данные (15 транзакций)
- ✅ Переиспользуемые компоненты
- ✅ Табы навигации
- ✅ Sidebar интеграция
- ✅ Responsive design
- ✅ Premium SaaS визуал
- ✅ Чистая архитектура
- ✅ TypeScript типизация
- ✅ Без ломания существующего кода

Готово для:
- Демонстрации stakeholders
- UX тестирования
- Сбора feedback
- Следующего этапа backend интеграции
