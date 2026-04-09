# Day Scenario Feature - Complete ✅

## Overview
Implemented "Сценарий дня" (Day Scenario) feature that transforms the plan into a beautiful timeline view when user has assembled 2+ activities.

## What Was Built

### 1. DayScenarioModal Component ✅
**Location**: `src/features/my-plan/components/DayScenarioModal.tsx`

**Features**:
- Full-screen bottom sheet on mobile
- Centered modal on desktop
- Beautiful vertical timeline with dots and connecting line
- Share functionality (native share API on mobile, clipboard on desktop)
- Empty state for <2 activities
- Clean, premium design

**Props**:
```typescript
interface DayScenarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  city: string;
  audienceLabel: string;
  items: PlanItemWithActivity[];
  layout?: "default" | "desktop";
}
```

### 2. CTA Visibility Logic ✅
**Condition**: Button appears only when `totalPlannedCount >= 2`

```typescript
const canOpenDayScenario = useMemo(() => {
  return totalPlannedCount >= 2;
}, [totalPlannedCount]);
```

- Counts only real user-added items
- Excludes suggestions
- Excludes empty slots
- Excludes temporary recommendations

### 3. CTA Placement ✅
**Location**: After all slots, before "Ещё идеи для этого дня"

**Text**:
- Primary: "Сценарий дня"
- Helper: "Откройте красивый таймлайн собранного дня"

### 4. Modal Structure ✅

**Header**:
- Title: "Сценарий дня"
- Subtitle: "Суббота, 4 апреля · Минск"
- Audience: "Для Таи и Степана"
- Share button (top-right)
- Close button (top-right)

**Timeline Content**:
- Vertical line connecting all items
- Timeline dots for each activity
- Time (bold, primary color)
- Title (semibold)
- Subtitle (place or category, muted)
- Optional image thumbnail (16x16 rounded)
- Clean spacing, airy layout

**Footer**:
- Activity count: "3 активности"
- "Готово" button to close

### 5. Share Functionality ✅

**Mobile**: Uses `navigator.share()` API

**Desktop**: Copies to clipboard with toast notification

**Format**:
```
Сценарий дня — Суббота, 4 апреля, Минск
Для Таи и Степана

09:00 — Детский театр
12:00 — Мастер-класс по рисованию
15:00 — Прогулка в парке

Собрано в mamaGo
```

### 6. Empty State ✅
If modal opened with <2 items:
- Icon: Clock
- Message: "Пока недостаточно активностей для сценария"
- Subtext: "Добавьте хотя бы 2 активности, чтобы увидеть сценарий дня"
- Action: "Добавить активность" (closes modal)

### 7. Data Flow ✅

**Input**:
- `date`: Selected date (ISO string)
- `city`: City slug
- `audienceLabel`: "Для Таи и Степана" (from selectedChildrenLabel)
- `items`: Array of PlanItemWithActivity (dayItems)

**Processing**:
- Items sorted by `startsAt` time
- Time formatted as "HH:MM"
- Date formatted as "Weekday, DD Month"
- City slug converted to readable name

### 8. Integration Points ✅

**PlanMainContent.tsx**:
- Added `showDayScenario` state
- Added `DayScenarioModal` import
- Updated "Сценарий дня" button to open modal (not navigate)
- Passed correct props: date, city, audienceLabel, items
- Added modal to both desktop and mobile layouts

## Design Decisions

### Timeline Design
- **Vertical line**: Absolute positioned, left-aligned
- **Dots**: 12px circles with 2px border, primary color
- **Spacing**: 24px between items (space-y-6)
- **Content**: Flex layout with time, title, subtitle, image

### Colors
- Timeline line: `bg-neutral-200`
- Timeline dots: `border-primary bg-white`
- Time: `text-primary font-semibold`
- Title: `text-neutral-900 font-semibold`
- Subtitle: `text-neutral-500`

### Typography
- Title: `text-base font-semibold leading-snug`
- Time: `text-sm font-semibold`
- Subtitle: `text-sm`
- Helper text: `text-xs text-neutral-500`

### Spacing
- Header padding: `px-5 py-4`
- Content padding: `px-5 py-6`
- Footer padding: `px-5 py-4`
- Item spacing: `space-y-6`

## UX Flow

1. User adds 2+ activities to plan
2. "Сценарий дня" button appears at bottom
3. User clicks button
4. Modal/sheet opens with smooth animation
5. Timeline displays all activities in chronological order
6. User can:
   - View the assembled day
   - Share via native share or clipboard
   - Close and return to plan

## Technical Details

### Helper Functions

**formatDate()**:
```typescript
// "2026-04-04" → "Суббота, 4 апреля"
function formatDate(dateStr: string): string
```

**formatTime()**:
```typescript
// ISO string → "09:00"
function formatTime(dateStr: string | null | undefined): string
```

**getCityName()**:
```typescript
// "minsk" → "Минск"
function getCityName(citySlug: string): string
```

**generateShareText()**:
```typescript
// Generates formatted text for sharing
function generateShareText(): string
```

### Responsive Behavior

**Mobile** (`layout="default"`):
- Full-screen bottom sheet
- Height: 90vh
- Swipe to dismiss

**Desktop** (`layout="desktop"`):
- Centered modal
- Max width: 512px (lg)
- Max height: 720px or 90vh
- Click outside to dismiss

## Files Created

1. `src/features/my-plan/components/DayScenarioModal.tsx` (new)

## Files Modified

1. `src/features/my-plan/components/PlanMainContent.tsx`
   - Added DayScenarioModal import
   - Added showDayScenario state
   - Updated button onClick handlers
   - Added modal components to both layouts

## Acceptance Criteria

- [x] Button appears only when day has 2+ activities
- [x] Opens modal/sheet with timeline
- [x] Timeline is clean and readable
- [x] Share works (mobile + desktop fallback)
- [x] No recommendations inside modal
- [x] UX feels like a "ready day plan", not a list
- [x] Smooth open/close animation
- [x] Premium clean layout
- [x] No visual overload
- [x] Timeline feels like "day journey"
- [x] Empty state handled gracefully

## Future Enhancements (Optional)

- [ ] Add slot separators ("Утро", "День", "Вечер")
- [ ] Add "Собрано автоматически" badge
- [ ] Add "Пересобрать" action
- [ ] Add "Редактировать вручную" action
- [ ] Add "Сохранить в мой план" persistence
- [ ] Add travel time estimates between activities
- [ ] Add weather information
- [ ] Add map view option

## Testing Notes

**Test Cases**:
1. Add 1 activity → button should not appear
2. Add 2 activities → button appears
3. Click button → modal opens
4. Timeline shows items in chronological order
5. Share button works on mobile (native share)
6. Share button works on desktop (clipboard + toast)
7. Close button works
8. Click outside modal closes it (desktop)
9. Swipe down closes sheet (mobile)
10. Empty state shows if <2 items

**Edge Cases**:
- Activities without time → sorted to beginning
- Activities without images → layout still works
- Activities without place/category → no subtitle shown
- Very long titles → truncated properly
- Many activities (5+) → scrollable timeline

---

**Status**: Implementation complete, ready for testing
**Date**: 2026-04-04
**Task**: Day Scenario Feature Implementation
