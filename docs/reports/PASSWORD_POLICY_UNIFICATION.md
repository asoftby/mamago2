# Password Policy Unification

## Цель

Унифицировать password policy во всех auth flows проекта. Ранее в разных местах использовались разные минимальные длины (6 и 8 символов) и разные сообщения об ошибках. Теперь все flows используют единый helper.

## Что было сделано

### 1. Создан общий helper

**Файл:** [`src/lib/auth/passwordPolicy.ts`](../../src/lib/auth/passwordPolicy.ts)

**Экспорты:**

| Экспорт | Тип | Значение |
|---|---|---|
| `PASSWORD_MIN_LENGTH` | `number` | `8` |
| `PASSWORD_MAX_LENGTH` | `number` | `128` |
| `PASSWORD_ERROR_MESSAGE` | `string` | `"Пароль должен быть не короче 8 символов"` |
| `passwordSchema` | `ZodString` | Zod-схема: `.min(8, error).max(128)`, без `.trim()` |
| `validatePasswordPolicy()` | `function` | Функция для проверки пароля вне Zod |

**Правила MVP:**
- `string`
- `trim` НЕ применяется (пробелы внутри пароля разрешены)
- `min` 8
- `max` 128
- generic error, без раскрытия количества символов в деталях

### 2. Заменены все локальные валидации

| # | Файл | Было | Стало |
|---|---|---|---|
| 1 | [`src/server/auth/register.ts`](../../src/server/auth/register.ts) | `z.string().min(6, ...)` | `passwordSchema` |
| 2 | [`src/server/auth/password-reset.ts`](../../src/server/auth/password-reset.ts) | `z.string().min(6, ...)` | `passwordSchema` |
| 3 | [`src/app/api/auth/register/route.ts`](../../src/app/api/auth/register/route.ts) | `z.string().min(8)` | `passwordSchema` |
| 4 | [`src/app/api/auth/complete-registration/route.ts`](../../src/app/api/auth/complete-registration/route.ts) | `z.string().min(8, ...)` | `passwordSchema` |
| 5 | [`src/app/api/settings/password/route.ts`](../../src/app/api/settings/password/route.ts) | `.min(8, ...).regex(...)` | `passwordSchema.regex(...)` |
| 6 | [`src/lib/auth/useAuthCredentialsFlow.ts`](../../src/lib/auth/useAuthCredentialsFlow.ts) | `const MIN_PASSWORD_LEN = 8` + `if (password.length < ...)` | `import { PASSWORD_MIN_LENGTH, validatePasswordPolicy }` |

### 3. Что НЕ менялось

- `src/server/auth/login.ts` — оставлен `.min(1)`, это проверка "не пустой" для логина, не creation flow
- `src/app/api/auth/login/route.ts` — не трогали, login logic
- hashing logic (`hashPassword`, `verifyPassword`) — без изменений
- legacy пользователи с существующими паролями — не затрагиваются

### 4. Тесты

**Файл:** [`src/lib/auth/passwordPolicy.test.ts`](../../src/lib/auth/passwordPolicy.test.ts)

Запуск: `npx tsx src/lib/auth/passwordPolicy.test.ts`

**Кейсы:**

| Кейс | Ожидание |
|---|---|
| 7 символов | fail |
| 8 символов | pass |
| 128 символов | pass |
| 129 символов | fail |
| Пробелы внутри пароля не удаляются | pass (14 символов) |
| Пустой пароль | fail |
| Пароль из пробелов (`"  ab  "`, 6 символов) | fail |

### 5. Проверки

- `pnpm lint` — пройден
- `pnpm typecheck` — пройден

## Структура файлов

```
src/lib/auth/
├── passwordPolicy.ts        # Shared helper (создан)
├── passwordPolicy.test.ts   # Тесты (создан)
├── useAuthCredentialsFlow.ts # Клиентский хук (изменён)
└── ...

src/server/auth/
├── register.ts              # Server action (изменён)
├── password-reset.ts        # Server action (изменён)
├── login.ts                 # НЕ изменён
└── ...

src/app/api/auth/
├── register/route.ts        # API route (изменён)
├── complete-registration/route.ts # API route (изменён)
├── login/route.ts           # НЕ изменён
└── ...

src/app/api/settings/
└── password/route.ts        # API route (изменён)
```
