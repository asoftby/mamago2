# Business bookings inbox — UI (second PR)

UI поверх серверной части из `bookings-inbox-server-pr.md`. Страница `/business/bookings`.

## Что в интерфейсе

- Переключатель «Входящие / Календарь». По умолчанию — входящие; календарь (старый вид) открывается
  по `?view=calendar`, а также по любым старым параметрам `?status=`, `?date=`, `?id=`, `?sort=`.
- Входящие читают `?tab=action|upcoming|customer|archive` и `?kind=all|standard|party`
  (нативные значения bucket тоже принимаются). Ссылка уведомления
  `/business/bookings?tab=action&kind=party` открывает «Требуют действий» → «Праздники».
- «Требуют действий»: сначала «Клиент ждёт», ниже «Закройте прошедшие». Пусто → «Всё обработано» + ближайшие.
- Действия:
  - PARTY SENT: reply with the quote via /respond.
  - PARTY AWAITING_RECONFIRM: choose available BookingUnit from GET /units and confirm it
    via POST /confirm (depends on PR #660), or send revised terms via /respond.
  - The confirmation operation rechecks availability inside a DB transaction.
    No eligible unit means NO confirmed booking.
  - PARTY истёкшее предложение → продлить (≤24 ч, не позже чем за час до праздника) или закрыть
    (`POST .../resolve`);
  - STANDARD прошедший визит → «Состоялся / Не состоялся» (`POST /api/business/bookings/{id}/outcome`);
  - STANDARD NEW и остальные → отдельная карточка по `GET /api/business/bookings/[id]`
    с проверкой `businessId` и `kind=STANDARD`, без ограничения в 200 записей календаря.

  Important: /respond creates a new QUOTED proposal; it does not confirm a booking.
  The real confirmation UI invokes the separate /confirm endpoint from PR #660.
- PARTY: контакты родителя нигде не показываются (в API инбокса их нет).
- Бейдж пункта меню «Записи и заказы» = `menuBadge` (только «Клиент ждёт»), обновляется при заходе,
  раз в минуту и после действий.

## Включение outbox-флага

Пока флаг не включён, воркер держит `PARTY_REQUEST_SENT` в PENDING
(`heldPartyOutboxEventTypes`, `src/server/birthday/partyOutbox.logic.ts`), потому что уведомление ведёт
на этот инбокс.

1. Убедиться, что релиз с этим UI задеплоен на окружение (проверить `gitSha`).
2. Выставить `BUSINESS_BOOKINGS_INBOX_UI=true` в env воркера **и** приложения этого окружения
   (DEV → затем PROD отдельным решением владельца).
3. Перезапустить воркер. Удержанные события доставятся при следующих проходах.
4. Проверка: под бизнесом с PARTY-заявкой ссылка из уведомления открывает «Требуют действий» → «Праздники».

Откат: убрать переменную и перезапустить воркер — новые события снова удерживаются.

## Проверки и ограничения

- Запустить `pnpm test:business-inbox-ui`, который входит в `pnpm test:responsive-business` (CI).
- Провести проверку на DEV с реальными и 200+ STANDARD заявками, пустыми фильтрами,
  сменой вкладок при медленном соединении и кросс-бизнес изоляцией.
- Demo/seed из старого PR #561 **не переносился**, никакие тестовые учётные данные или DB seed
  не попадают в эту ветку.
- Названия вкладок соответствуют серверным buckets, но перед активацией релиза
  требуют сверки с утверждённым UX.
- Активация `BUSINESS_BOOKINGS_INBOX_UI` в worker/app только после DEV smoke.


## Release prerequisites

- PR #660 is required before this client can call /units and /confirm.
- Business UI notifications remain gated by BUSINESS_BOOKINGS_INBOX_UI=true.
- Parent acceptance and business confirmation additionally require PARTY_CONFIRMATION_ENABLED=true.
- Both flags default to false and must be enabled separately only after DEV smoke.
- Do not deploy the client with active confirmation buttons before its server endpoints.
