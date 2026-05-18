# ADMIN_ROLE_CHANGE_AUDIT_FIX

## Проблема

Роут [`POST /api/admin/users/promote`](src/app/api/admin/users/promote/route.ts) изменял роль пользователя (вплоть до `ADMIN`), но операция логировалась только в `console.log`. При отсутствии мониторинга консоли сервера такие изменения проходили незамеченными — отсутствовал персистентный audit trail.

## Изменения

### 1. Замена `console.log` на запись в `AuditLog` БД

**Файл:** [`src/app/api/admin/users/promote/route.ts`](src/app/api/admin/users/promote/route.ts:99)

- Удалён блок `console.log` (строки 113–121 в оригинале)
- Вместо отдельного `prisma.user.update()` теперь используется `prisma.$transaction`, который атомарно выполняет:
  1. [`prisma.user.update`](src/app/api/admin/users/promote/route.ts:103) — смена роли
  2. [`prisma.auditLog.create`](src/app/api/admin/users/promote/route.ts:112) — запись в audit log

Если любой из двух шагов завершается ошибкой, **оба откатываются** (транзакция rollback). Это гарантирует, что смена роли не произойдёт без аудита и наоборот.

### 2. Детали audit event

| Поле | Значение | Комментарий |
|------|----------|-------------|
| `actorId` | `currentUser.id` | Кто выполнил promote (всегда `ADMIN`) |
| `targetType` | `"USER"` | Тип объекта — пользователь |
| `targetId` | `targetUser.id` | ID пользователя, которому сменили роль |
| `action` | `"USER_ROLE_CHANGED"` | Использован существующий нейминг из [`userModeration.service.ts`](src/server/services/userModeration.service.ts:369) |
| `metadata` | `{ oldRole, newRole }` | Формат полей совпадает с существующим паттерном (см. `changeUserRole` в `userModeration.service.ts:370`) |

### 3. Почему именно `USER_ROLE_CHANGED`

В проекте уже сложился паттерн именования audit actions:
- [`USER_UNBANNED`](src/server/services/userModeration.service.ts:325)
- [`USER_ROLE_CHANGED`](src/server/services/userModeration.service.ts:369)

Все action — строки в `UPPER_SNAKE_CASE`, в past tense. Использован тот же стиль.

### 4. Что НЕ изменилось

- `console.error` в catch-блоке остался — это стандартный server-side error log, не заменяющий audit trail, а служащий для диагностики ошибок.
- Schema Prisma не менялась — модель `AuditLog` уже существует.
- UI не менялся.
- Логика роута (валидация, поиск пользователя, возвращаемые поля) не менялась.

### 5. Проверки

```bash
pnpm typecheck
pnpm lint
```
