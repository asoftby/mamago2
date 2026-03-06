# Hydration Mismatch Fix - Date Formatting

## Дата
7 марта 2026

## Проблема

React hydration error в компоненте ActivityCard:

```
Hydration failed because the server rendered text didn't match the client.

Server: "6+ • 8 марта. • от 15 BYN • ★ 4,9"
Client: "6+ • 8 мар. • от 15 BYN • ★ 4,9"
```

**Разница**: "8 марта." (сервер) vs "8 мар." (клиент)

## Причина

Функция `formatRuShortDayMonth()` использовала `Intl.DateTimeFormat("ru-RU")` для форматирования дат. Проблема в том, что:

1. **Node.js (сервер)** и **браузер (клиент)** могут иметь разные версии ICU (International Components for Unicode)
2. Разные версии ICU могут форматировать месяцы по-разному:
   - Старая версия: "марта" (родительный падеж)
   - Новая версия: "мар." (сокращение)
3. Это приводит к несоответствию между SSR и клиентской гидратацией

## Решение

Заменил `Intl.DateTimeFormat` на **хардкодные названия месяцев**:

```typescript
const RU_MONTH_SHORT = [
  "янв.", "фев.", "мар.", "апр.", "мая", "июн.",
  "июл.", "авг.", "сен.", "окт.", "ноя.", "дек."
];

export function formatRuShortDayMonth(date: Date | string): string {
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return "";
    }

    const day = dateObj.getDate();
    const monthIndex = dateObj.getMonth();
    const monthShort = RU_MONTH_SHORT[monthIndex];

    return `${day} ${monthShort}`;
  } catch (error) {
    console.error("formatRuShortDayMonth error:", error);
    return "";
  }
}
```

## Преимущества нового подхода

1. ✅ **100% детерминированность** - одинаковый результат на сервере и клиенте
2. ✅ **Не зависит от ICU версии** - работает везде одинаково
3. ✅ **Быстрее** - нет overhead от Intl API
4. ✅ **Проще** - понятный и предсказуемый код
5. ✅ **Нет hydration mismatch** - React не будет пересоздавать дерево

## Тестирование

Проверено форматирование всех 12 месяцев:

```
2024-01-15 → 15 янв.
2024-02-28 → 28 фев.
2024-03-08 → 8 мар.
2024-04-01 → 1 апр.
2024-05-09 → 9 мая
2024-06-12 → 12 июн.
2024-07-04 → 4 июл.
2024-08-20 → 20 авг.
2024-09-01 → 1 сен.
2024-10-31 → 31 окт.
2024-11-07 → 7 ноя.
2024-12-25 → 25 дек.
```

## Файлы изменены

1. ✅ `src/lib/formatters/date.ts` - переписана функция `formatRuShortDayMonth`

## Рекомендации для будущего

### Правило: Избегайте Intl в SSR компонентах

Если нужно форматировать данные в SSR компонентах, используйте:

1. **Хардкодные значения** (как в этом случае)
2. **Библиотеки с детерминированным выводом** (например, date-fns с явной локалью)
3. **Клиентские компоненты** с `suppressHydrationWarning` (только если необходимо)

### Плохо ❌

```typescript
// Может давать разные результаты на сервере и клиенте
const formatted = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short"
}).format(date);
```

### Хорошо ✅

```typescript
// Всегда одинаковый результат
const monthNames = ["янв.", "фев.", "мар.", ...];
const formatted = `${date.getDate()} ${monthNames[date.getMonth()]}`;
```

### Альтернатива для сложных случаев

Если нужно сложное форматирование, используйте клиентский компонент:

```typescript
"use client";

export function FormattedDate({ date }: { date: Date }) {
  return (
    <span suppressHydrationWarning>
      {new Intl.DateTimeFormat("ru-RU").format(date)}
    </span>
  );
}
```

## Результат

После исправления:
- ✅ Нет hydration mismatch ошибок
- ✅ Одинаковый вывод на сервере и клиенте
- ✅ Быстрее работает
- ✅ Проще поддерживать

## Заключение

Hydration mismatch исправлен путем замены недетерминированного `Intl.DateTimeFormat` на хардкодные названия месяцев. Это гарантирует одинаковый результат на сервере и клиенте.
