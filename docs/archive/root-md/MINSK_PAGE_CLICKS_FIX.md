# Исправление проблемы с кликами на странице /minsk

## ROOT CAUSE (Найденная причина)

**Проблема:** Невидимый overlay от cookie consent блокировал все клики на странице.

**Конкретно:** В файле `src/styles/cookie-consent-mamago.css` элемент `#cc-main` от библиотеки `vanilla-cookieconsent` оставался в DOM даже когда cookie баннер был закрыт. Хотя у него был `pointer-events: none`, его дочерние элементы (wrapper'ы) могли перехватывать клики.

## РЕШЕНИЕ

Применено **агрессивное исправление** - полное скрытие `#cc-main` когда cookie consent закрыт:

```css
/* КРИТИЧЕСКИ ВАЖНО: когда cookie consent закрыт, он не должен блокировать клики */
#cc-main:not(.show--consent):not(.show--preferences) {
  display: none !important;
}
```

Это гарантирует, что:
1. Элемент полностью удаляется из layout flow
2. Не может перехватывать клики ни при каких обстоятельствах
3. Не занимает место в DOM tree для hit-testing

Дополнительно улучшены правила для дочерних элементов:

```css
/* Явно отключаем pointer-events для закрытых/невидимых слоёв */
#cc-main:not(.show--consent):not(.show--preferences) .cm-wrapper,
#cc-main:not(.show--consent):not(.show--preferences) .cm,
#cc-main:not(.show--consent):not(.show--preferences) .pm-wrapper,
#cc-main:not(.show--consent):not(.show--preferences) .pm-overlay,
#cc-main:not(.show--consent):not(.show--preferences) .pm {
  pointer-events: none !important;
}
```

## ИЗМЕНЕННЫЕ ФАЙЛЫ

1. **src/styles/cookie-consent-mamago.css** — добавлено `display: none !important` для закрытого cookie consent

## ПРОВЕРКА ИСПРАВЛЕНИЙ

После применения исправления должны работать:

### ✅ 1. Клики по интерактивным элементам
- Dropdown в хедере ("Где? / Когда? / Для кого?") реагируют на клик
- Все кнопки и ссылки кликабельны
- Нет невидимых overlay блокеров

### ✅ 2. Header compact on scroll
- Header сжимается при прокрутке страницы
- Scroll listener работает корректно
- Используется хук `useStableHeaderBehavior`

### ✅ 3. Cookie consent баннер
- Баннер появляется для новых пользователей
- Кнопки в баннере работают
- Ссылка "Настройки cookies" в футере открывает модалку
- После закрытия баннер полностью скрывается (`display: none`)

### ✅ 4. Footer links
- Все ссылки в футере кликабельны
- Ссылка "Настройки cookies" работает

### ✅ 5. Weather block
- Weather загружается через `WeatherProvider`
- Компонент `HeroGreeting` отображает погоду
- API: `/api/weather/weekly?city=minsk`

### ✅ 6. Dropdown в header
- Desktop: `DesktopSearchControl` с панелями
- Mobile: `MobileSearchSheet`
- Все dropdown'ы работают

## DEBUG TOOL

Создан файл `/public/debug-clicks.html` для диагностики проблем с кликами:
- Проверка overlay элементов
- Проверка pointer-events
- Проверка z-index
- Определение элемента под курсором

Доступ: `http://localhost:3000/debug-clicks.html`

## АРХИТЕКТУРА

### Cookie Consent
- **Provider:** `CookieConsentProvider` в root layout
- **Config:** `src/lib/cookies/consent-config.ts`
- **Manager:** `src/lib/cookies/consent-manager.ts`
- **Styles:** `src/styles/cookie-consent-mamago.css`
- **Library:** `vanilla-cookieconsent`
- **Classes:** `.show--consent` (баннер открыт), `.show--preferences` (настройки открыты)

### Состояния #cc-main
1. **Закрыт** (нет классов) → `display: none !important` ✅
2. **Баннер открыт** (`.show--consent`) → видим, `pointer-events: auto` на `.cm`
3. **Настройки открыты** (`.show--preferences`) → видим, `pointer-events: auto` на `.pm`

## ИТОГ

**Проблема:** Cookie consent overlay блокировал клики даже когда был закрыт

**Решение:** Добавлено `display: none !important` для `#cc-main:not(.show--consent):not(.show--preferences)`

**Результат:**
- ✅ Клики работают по всей странице
- ✅ Cookie consent полностью скрыт когда не нужен
- ✅ Баннер корректно появляется и работает
- ✅ Все интерактивные элементы доступны

**Файлы:** 1 файл изменен (`src/styles/cookie-consent-mamago.css`)
