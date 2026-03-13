# Mobile & Desktop Sticky Header - Test Instructions

## ✅ Implemented Features

### 1. Mobile Sticky Header
- Mobile header теперь sticky (остается вверху при скролле)
- Sticky позиционирование на wrapper div для корректной работы
- Добавлена тень при скролле для визуального разделения

### 2. Desktop Sticky Header
- Desktop header также sticky (исправлено после мобильных изменений)
- Сохранена вся существующая функциональность (компактный режим, анимации)
- Правильные z-index значения для обеих версий

### 3. Mobile Collapsible Intent Tabs
- Разделы (Куда пойти, Занятия, ДР, Маршруты) скрываются при скролле вниз
- Плавная анимация скрытия/показа (300ms transition)
- Используется `useHeaderScrolled` хук с порогом 50px

### 4. Search Entry Always Visible
- Строка поиска и кнопка фильтров остаются видимыми всегда
- Только intent tabs скрываются при скролле на мобильном

## 🧪 How to Test

### Test Pages
Navigate to any discovery page:
- `/minsk/` (Куда пойти)
- `/minsk/birthday/` (День рождения)
- `/minsk/classes/` (Занятия)
- `/minsk/routes/` (Маршруты)

### Mobile Test Scenarios

1. **Initial State**
   - Header should be visible with search bar and intent tabs
   - No shadow on header

2. **Scroll Down (>50px)**
   - Intent tabs should smoothly slide up and disappear
   - Header should gain a subtle shadow
   - Search bar and filter button remain visible
   - **Header should stay at the top (sticky)**

3. **Scroll Back Up**
   - Intent tabs should smoothly slide back down and appear
   - Shadow should disappear
   - All functionality should work normally

### Desktop Test Scenarios

1. **Initial State**
   - Full header with logo, intent tabs, search, and profile buttons
   - No shadow on header

2. **Scroll Down (>20px)**
   - Header should become compact (smaller padding)
   - Intent tabs should slide up and disappear
   - Search should become compact with expand button
   - Filter button should appear (on intent pages)
   - **Header should stay at the top (sticky)**
   - Strong shadow should appear

3. **Compact Mode Interactions**
   - Clicking search should expand header temporarily
   - Clicking outside should collapse back to compact
   - Scrolling while expanded should collapse after threshold

## 🔧 Technical Implementation

### Files Modified
- `src/components/site/header/SiteHeader.tsx`
  - Added sticky positioning to both desktop and mobile wrappers
  - Desktop: `"hidden md:block sticky top-0 z-[100]"`
  - Mobile: `"block md:hidden sticky top-0 z-50"`

- `src/components/site/header/SiteHeader.desktop.tsx`
  - Removed sticky classes (now on wrapper)
  - Maintained all existing functionality

- `src/components/site/header/SiteHeader.mobile.tsx`
  - Added `useHeaderScrolled(50)` hook
  - Added conditional styling for intent tabs section
  - Added shadow transition for header
  - Removed sticky classes (now on wrapper)

### Key CSS Classes
```tsx
// Desktop wrapper with sticky positioning
<div className="hidden md:block sticky top-0 z-[100]">

// Mobile wrapper with sticky positioning  
<div className="block md:hidden sticky top-0 z-50">

// Mobile header with conditional shadow
className={cn(
  "bg-white transition-shadow duration-200",
  isScrolled && "shadow-sm"
)}

// Mobile intent tabs with collapse animation
className={cn(
  "py-4 transition-all duration-300 ease-in-out overflow-hidden",
  isScrolled 
    ? "max-h-0 py-0 opacity-0 pointer-events-none" 
    : "max-h-[100px] opacity-100"
)}
```

### Performance Notes
- Uses passive scroll listener for optimal performance
- Smooth CSS transitions instead of JavaScript animations
- Minimal re-renders with proper state management
- Proper z-index hierarchy (desktop: 100, mobile: 50)

## ✨ User Experience
- Clean, modern sticky header behavior on both desktop and mobile
- More screen real estate for content when scrolling
- Search functionality always accessible
- Smooth, polished animations
- Consistent behavior across devices

## 🐛 Bug Fixes
- **Fixed desktop sticky positioning**: Added `sticky top-0 z-[100]` to desktop wrapper
- **Fixed mobile sticky positioning**: Moved `sticky top-0 z-50` to mobile wrapper
- **Resolved z-index conflicts**: Desktop (100) > Mobile (50) for proper layering