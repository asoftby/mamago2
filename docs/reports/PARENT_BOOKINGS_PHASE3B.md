# Parent Bookings — Фаза 3B

**Дата:** 12 мая 2026  
**Статус:** ✅ Завершено  
**Цель:** Consumer-facing раздел "Мои записи" для родителей

---

## Что создано

### Новые файлы

| Файл | Назначение |
|------|-----------|
| `src/app/(public)/me/bookings/page.tsx` | Server page, auth guard, data loading |
| `src/app/(public)/me/bookings/ParentBookingsClient.tsx` | Client shell: секции, empty state |
| `src/app/(public)/me/bookings/ParentBookingCard.tsx` | Карточка заявки с CTA |
| `src/app/(public)/me/bookings/FeedbackWidget.tsx` | Inline star rating + comment |
| `src/server/services/booking/parentBookings.service.ts` | Data layer: getParentBookings() |

### Изменённые файлы

| Файл | Изменение |
|------|-----------|
| `src/app/(public)/me/page.tsx` | Добавлен shortcut "Мои записи" |
| `src/lib/notifications/notificationRegistry.ts` | href обновлён с `/me` на `/me/bookings` |
| `src/server/services/notification.service.ts` | ctaAction обновлён с `/me` на `/me/bookings` |
| `src/lib/notifications/routing.ts` | Fallback routing для USER booking types |

---

## Поддерживаемые статусы

| Статус | Секция | Визуал | CTA |
|--------|--------|--------|-----|
| NEW | Активные | 🟡 Amber "Ожидает подтверждения" | Текст-подсказка |
| CONFIRMED | Активные | 🟢 Emerald "Подтверждена" | "Открыть" + "В план" |
| COMPLETED | Завершённые | ⚪ Neutral "Завершена" | Feedback widget |
| REJECTED | Отменённые | 🔴 Red "Отклонена" | — |
| CANCELLED | Отменённые | ⚪ Muted "Отменена" | — |

---

## CTA по статусам

### NEW — Ожидает подтверждения
- Текст: "Ожидаем подтверждения от организатора"
- Нет action кнопок (пользователь ждёт)

### CONFIRMED — Подтверждена
- **"Открыть"** → ссылка на страницу события/предложения/места (если есть slug)
- **"В план"** → `/me/plan?add={activityId}&date={date}` (только для activity с датой)

### COMPLETED — Завершена
- **FeedbackWidget** — inline star rating (1–5) + опциональный комментарий
- После отправки: "Спасибо за отзыв! 🙏"
- Если уже оставлен: "Вы оценили на X из 5"
- API: `POST /api/bookings/{id}/feedback` (уже существовал)

### REJECTED / CANCELLED — Отменена
- Карточка приглушена (opacity-70)
- Нет CTA

---

## Структура страницы

```
/me/bookings
├── Header (← назад, заголовок, счётчик)
├── [Empty state] — если нет записей
│   ├── CTA "Найти занятия" → /search
│   └── CTA "Куда пойти" → /
├── Секция "Активные" (NEW + CONFIRMED)
│   └── ParentBookingCard × N
├── Секция "Завершённые" (COMPLETED)
│   └── ParentBookingCard × N (с FeedbackWidget)
└── Секция "Отменённые" (REJECTED + CANCELLED)
    └── ParentBookingCard × N (приглушены)
```

---

## Карточка заявки

Показывает:
- **Cover image** (из offer/activity/place, 80×80px)
- **Status badge** с иконкой
- **Название** (ссылка на публикацию если есть slug)
- **Дата/смена** (из display.subtitle — CalendarDays icon, peach color)
- **Название бизнеса** (MapPin icon)
- **Данные ребёнка** (Baby icon, если есть)

---

## Plan Integration

Кнопка "В план" доступна для CONFIRMED заявок с `activityId` и `requestedDate`.

Ссылка: `/me/plan?add={activityId}&date={YYYY-MM-DD}`

**Ограничения:**
- Только для activity-based bookings (не camp shift, не offer, не place)
- Требует наличия `requestedDate` в заявке
- Нет real-time sync — пользователь переходит на страницу плана
- Нет проверки "уже в плане" на карточке (TODO: future phase)

---

## Feedback Integration

**Полностью рабочий flow:**
1. Booking COMPLETED → показывается FeedbackWidget
2. Пользователь выбирает звёзды (1–5)
3. Опционально добавляет комментарий
4. `POST /api/bookings/{id}/feedback` → `createBookingFeedback()`
5. После успеха: виджет заменяется на "Спасибо за отзыв! 🙏"
6. Состояние сохраняется в React state (без перезагрузки страницы)

**Защиты:**
- 409 Conflict (уже оставлен) → обрабатывается как успех
- Rate limit (10/24ч) → показывается ошибка
- Анонимные пользователи не видят страницу (redirect → /login)

---

## Notification Integration

Все USER booking notifications теперь ведут на `/me/bookings`:

| NotificationType | href |
|-----------------|------|
| BOOKING_CONFIRMED | `/me/bookings` |
| BOOKING_CANCELLED | `/me/bookings` |
| BOOKING_COMPLETED | `/me/bookings` |
| BOOKING_FEEDBACK_REQUEST | `/me/bookings` |

Обновлено в:
- `notificationRegistry.ts` → `resolveHref`
- `notification.service.ts` → `ctaAction`
- `routing.ts` → fallback routing

---

## Entry Point

На странице `/me` добавлен shortcut:

```
┌─────────────────────────────────────┐
│ 📅  Мои записи                    › │
│     Заявки и бронирования           │
└─────────────────────────────────────┘
```

---

## Future Phase

### Высокий приоритет

1. **`/me/bookings/[id]` — detail page**
   - Полная информация о заявке
   - История статусов
   - Форма отзыва на отдельной странице
   - Обновить `ctaAction` в `notifyUserBookingFeedbackRequest`

2. **"Уже в плане" state**
   - Проверять `PlanItem` при загрузке
   - Показывать "В плане" вместо "В план"

### Средний приоритет

3. **Анонимные заявки**
   - Email-уведомления по `customerEmail`
   - Страница `/bookings/track?phone=...` для гостей

4. **BOOKING_FEEDBACK_REQUEST timing**
   - Сейчас отправляется сразу после COMPLETED
   - Рассмотреть задержку 2–4 часа через scheduled job

5. **Pull-to-refresh / revalidation**
   - Сейчас страница статическая (SSR)
   - Добавить `router.refresh()` после feedback submit

---

## TypeScript

```
pnpm tsc --noEmit
```

**Результат:** 1 ошибка в `bookingActivity.service.ts:49` — известная, несвязанная. Новых ошибок нет.

---

**Статус:** ✅ Production Ready  
**Дата:** 12 мая 2026
