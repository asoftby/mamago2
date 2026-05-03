# Чеклист для проверки исправления кликов на /minsk

## Быстрая проверка

1. **Откройте страницу:** http://localhost:3000/minsk
2. **Очистите cookies** (чтобы увидеть cookie banner)
3. **Проверьте клики:**

### ✅ Cookie Banner
- [ ] Баннер появляется для нового пользователя
- [ ] Кнопка "Принять все" работает
- [ ] Кнопка "Только необходимые" работает
- [ ] Кнопка "Настроить" работает
- [ ] После закрытия баннера клики по странице работают

### ✅ Header (Desktop)
- [ ] Клик по логотипу работает
- [ ] Клик по вкладкам "Куда пойти / Занятия / Маршруты / Журнал" работает
- [ ] Клик по строке поиска открывает панели
- [ ] Панели "Где? / Когда? / Для кого?" открываются
- [ ] Клик по иконке поиска работает
- [ ] Клик по иконке аккаунта работает

### ✅ Header (Mobile)
- [ ] Клик по строке поиска открывает search sheet
- [ ] Клик по кнопке фильтров работает
- [ ] Search sheet открывается и закрывается

### ✅ Scroll Behavior
- [ ] При скролле вниз header сжимается (compact mode)
- [ ] При скролле вверх header разворачивается
- [ ] Анимация плавная, без рывков

### ✅ Weather Block
- [ ] Погода отображается в hero секции
- [ ] Иконка погоды видна
- [ ] Текст с температурой и описанием виден

### ✅ Footer
- [ ] Все ссылки в футере кликабельны
- [ ] Ссылка "Настройки cookies" открывает модалку настроек
- [ ] Модалка настроек работает корректно

### ✅ Content
- [ ] Клики по карточкам событий работают
- [ ] Клики по кнопкам "Сохранить" работают
- [ ] Все интерактивные элементы доступны

## Debug Tool

Если клики все еще не работают:

1. Откройте: http://localhost:3000/debug-clicks.html
2. Нажмите "Check Overlays" - проверит все overlay элементы
3. Нажмите "Check Pointer Events" - покажет элемент под курсором
4. Нажмите "Check Z-Index" - покажет элементы с высоким z-index

## Browser DevTools

### Проверка #cc-main

1. Откройте DevTools (F12)
2. В Console выполните:
```javascript
const ccMain = document.getElementById('cc-main');
if (ccMain) {
  console.log('cc-main exists');
  console.log('Display:', window.getComputedStyle(ccMain).display);
  console.log('Pointer Events:', window.getComputedStyle(ccMain).pointerEvents);
  console.log('Classes:', ccMain.className);
} else {
  console.log('cc-main not found');
}
```

**Ожидаемый результат (когда баннер закрыт):**
```
cc-main exists
Display: none
Pointer Events: none
Classes: (пусто или без show--consent/show--preferences)
```

### Проверка элемента под курсором

В Console:
```javascript
document.addEventListener('click', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  console.log('Clicked element:', el);
  console.log('Tag:', el.tagName);
  console.log('ID:', el.id);
  console.log('Class:', el.className);
  console.log('Pointer Events:', window.getComputedStyle(el).pointerEvents);
});
```

## Если проблема не решена

### Проверьте другие overlay

```javascript
// Найти все fixed/absolute элементы с большим z-index
Array.from(document.querySelectorAll('*'))
  .filter(el => {
    const style = window.getComputedStyle(el);
    const zIndex = parseInt(style.zIndex);
    return (style.position === 'fixed' || style.position === 'absolute') && 
           zIndex > 1000;
  })
  .map(el => ({
    tag: el.tagName,
    id: el.id,
    class: el.className,
    zIndex: window.getComputedStyle(el).zIndex,
    pointerEvents: window.getComputedStyle(el).pointerEvents,
    display: window.getComputedStyle(el).display
  }))
  .sort((a, b) => parseInt(b.zIndex) - parseInt(a.zIndex));
```

### Проверьте cookie consent состояние

```javascript
// Проверить состояние cookie consent
if (window.CookieConsent) {
  console.log('CookieConsent loaded');
  console.log('Valid consent:', window.CookieConsent.validConsent());
} else {
  console.log('CookieConsent not loaded yet');
}
```

## Контакты для отчета

Если проблема не решена, предоставьте:
1. Скриншот DevTools с результатами проверок выше
2. Версию браузера
3. Описание: какие именно клики не работают
4. Результат из debug-clicks.html
