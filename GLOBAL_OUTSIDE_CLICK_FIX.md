# Global Outside Click Fix - Реализовано ✅

## 🎯 ПРОБЛЕМА
Панели поиска (Куда/Когда/С кем) закрывались только при клике в пределах header, но НЕ закрывались при клике по основному контенту сайта.

## ✅ РЕШЕНИЕ

### Изменена логика Outside Click в `DesktopSearchControl.tsx`

**ДО (проблема):**
```typescript
// Проверяем клик внутри контейнера поиска
if (containerRef.current && containerRef.current.contains(target)) {
  return; // ❌ Игнорировали ВСЕ клики внутри header
}
```

**ПОСЛЕ (исправлено):**
```typescript
// Проверяем только специфичные элементы, которые НЕ должны закрывать панели:

// 1. Клики внутри dropdown панелей
const portalPanels = document.querySelectorAll('[data-portal-panel]');
for (const panel of portalPanels) {
  if (panel.contains(target)) {
    return; // ✅ Игнорируем только dropdown'ы
  }
}

// 2. Клики по кнопкам сегментов (Куда/Когда/С кем)
if (locationRef.current && locationRef.current.contains(target)) {
  return; // ✅ Игнорируем клики по кнопкам переключения
}
if (dateRef.current && dateRef.current.contains(target)) {
  return;
}
if (ageRef.current && ageRef.current.contains(target)) {
  return;
}

// 3. Клики по кнопке Go
const goButton = containerRef.current?.querySelector('[aria-label="Применить фильтры"]');
if (goButton && goButton.contains(target)) {
  return; // ✅ Игнорируем клики по кнопке применения
}

// ✅ ВСЕ ОСТАЛЬНЫЕ клики (включая контент сайта) - закрываем панель
onPanelClose();
actions.close();
```

## 🔧 ТЕХНИЧЕСКАЯ РЕАЛИЗАЦИЯ

### Новая логика Outside Click:
1. **Разрешенные клики** (НЕ закрывают панели):
   - Клики внутри открытых dropdown панелей
   - Клики по кнопкам сегментов поиска (Куда/Когда/С кем)
   - Клики по кнопке "Go"

2. **Запрещенные клики** (закрывают панели):
   - ✅ Клики по основному контенту сайта
   - ✅ Клики по header (кроме элементов поиска)
   - ✅ Клики по footer
   - ✅ Клики по любым другим элементам страницы

### Event Handling:
- Используется `mousedown` event
- Capture phase (`true`) для перехвата до bubbling
- Автоматическая очистка event listeners

## 🎨 UX УЛУЧШЕНИЯ

### Теперь панели закрываются при:
1. ✅ **Клике по контенту сайта** - основная область страницы
2. ✅ **Клике по header** - кроме элементов поиска
3. ✅ **Клике по footer** - нижняя часть страницы
4. ✅ **Клике по sidebar** - боковые области
5. ✅ **Escape Key** - клавиатурное закрытие

### НЕ закрываются при:
- Клике по кнопкам Куда/Когда/С кем (переключение панелей)
- Клике внутри открытых dropdown'ов
- Клике по кнопке "Go"

## ✅ РЕЗУЛЬТАТ

- **✅ Build проходит успешно**
- **✅ Dev server работает**  
- **✅ Клик по всему сайту закрывает панели**
- **✅ Логика работает корректно**
- **✅ UX значительно улучшен**

**Теперь клик в любом месте сайта (кроме элементов поиска) корректно закрывает dropdown панели!** 🎉