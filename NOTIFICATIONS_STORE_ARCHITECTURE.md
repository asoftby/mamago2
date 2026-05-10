# Notification store architecture (Phase 1B)

## Зачем

Централизовать загрузку счётчика непрочитанных, первой страницы ленты, mark-open и кеш списка между public / business / admin. Убрать разрозненные `window.addEventListener(NOTIFICATIONS_CHANGED_EVENT)` из UI и держать **один** compatibility-адаптер для старых `dispatchEvent`.

## Структура

```
src/features/notifications/store/
├── notification-store.ts    # Zustand: state + actions
├── notification-types.ts    # NotificationState, NotificationItem
├── notification-actions.ts  # fetch helpers (GET unread-count, GET list, POST mark-open)
├── notification-selectors.ts
├── notification-sync.ts     # mountNotificationEventBridge — единственный слушатель notifications-changed (+ poll / visibility / auth refresh)
└── index.ts

src/features/notifications/NotificationStoreAuthSync.tsx  # sync authenticated + первичный refresh при mounted в GlobalProviders
```

## Поток состояния

1. **`NotificationStoreAuthSync`** (внутри `GlobalProviders`, под `AuthProvider`): выставляет `authenticated`, при выходе вызывает `reset()`, при входе — `refreshUnreadOnly()` (без ленты).
2. **`mountNotificationEventBridge()`** (один раз на вкладку):  
   - `notifications-changed` → `store.refresh()`  
   - `auth-state-changed` → `store.refresh()`  
   - `visibilitychange` (visible) → `refreshUnreadOnly()`  
   - интервал 60 с → `refreshUnreadOnly()`
3. **Бейдж (public)**: `UnreadNotificationCountProvider` по-прежнему экспортирует контекст, но значения берёт из `useNotificationStore` (`unreadCount`).
4. **Бейдж business**: `NotificationsDropdown` читает `businessUnreadCount`.
5. **Панель**: при `open === true` `NotificationFeed` вызывает `openPanel()`:
   - если список ещё не гидратирован — один `GET /api/notifications?limit=15&offset=0`, затем при необходимости `POST /api/notifications/mark-open`;
   - если уже гидратирован — **без сетевых запросов**.

## Sync flow (compatibility)

- Эмиттеры **`notifyNotificationsChanged()`** / **`notifyPostAuthSync()`** не удалены.
- Подписка на **`NOTIFICATIONS_CHANGED_EVENT`** живёт **только** в `notification-sync.ts`.
- Новый код должен вызывать store (`refresh`, `refreshUnreadOnly`), а не слушать window.

## Запрещено в UI / новых хуках

- Не вызывать **`fetch(.../mark-open)`** напрямую из компонентов — только через actions стора (`markAllRead` / внутренний сценарий `openPanel`).
- Не держать локальный **`unreadCount`** для глобального бейджа — только селекторы стора / совместимый контекст.
- Не подписываться на **`NOTIFICATIONS_CHANGED_EVENT`** в компонентах.
- Не дублировать **debounce / inflight** для тех же запросов — дедуп в `inflight` стора.

## Будущее: realtime / PWA / push

- Точка расширения: один сервис (SW или websocket), который по входящему событию вызывает `useNotificationStore.getState().refresh()` или точечно `appendNotification` / `incrementUnread`.
- Window event можно заменить полностью на вызов стора; адаптер удалить отдельной фазой после аудита внешних вызовов `dispatchEvent("notifications-changed")`.
