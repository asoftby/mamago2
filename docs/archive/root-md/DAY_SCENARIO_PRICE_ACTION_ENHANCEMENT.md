# Day Scenario Timeline Enhancement - Price & Action Links ✅

## Overview
Enhanced DayScenarioModal timeline items with price information and actionable links (buy/booking) while maintaining the clean, premium UI aesthetic.

## What Was Enhanced

### 1. Added Price Display ✅
**Logic**:
- Shows `priceText` if available (custom text like "от 15 BYN")
- Falls back to "Бесплатно" if `priceFrom === 0`
- Falls back to "от {priceFrom} {currency}" if numeric price exists
- Returns `null` if no price data available

**Implementation**:
```typescript
function formatPrice(activity: NonNullable<PlanItemWithActivity["activity"]>): string | null {
  const text = activity.priceText?.trim();
  if (text) return text;
  if (activity.priceFrom === 0) return "Бесплатно";
  if (activity.priceFrom != null && !Number.isNaN(activity.priceFrom)) {
    const cur = (activity.currency || "BYN").trim();
    return `от ${activity.priceFrom} ${cur}`;
  }
  return null;
}
```

### 2. Added Action Links ✅
**Priority Order**:
1. If `ticketUrl` exists → "Купить →" (external link)
2. If `participationMode === "simple-booking"` → "Записаться →" (internal link)
3. If `participationMode === "time-slots"` → "Выбрать время →" (internal link)

**Implementation**:
- Uses existing `resolveActivityParticipationCta()` helper
- Shortens labels: "Купить билет" → "Купить"
- Shortens labels: "Записаться" → "Записаться"
- Adds arrow indicator: "→"

### 3. Combined Display Format ✅
**Examples**:
- `от 15 BYN · Купить →`
- `Бесплатно · Записаться →`
- `от 25 BYN` (price only, no action)
- `Записаться →` (action only, no price)

**Rendering**:
```tsx
{(price || cta) ? (
  <div className="mt-1.5 flex items-center gap-1.5 text-sm text-neutral-600">
    {price ? <span>{price}</span> : null}
    {price && cta ? <span>·</span> : null}
    {cta ? (
      <a href={cta.href} className="...">
        {shortLabel} →
      </a>
    ) : null}
  </div>
) : null}
```

### 4. Styling ✅
**Design Decisions**:
- Text size: `text-sm` (14px)
- Color: `text-neutral-600` (secondary, not primary)
- Hover: `hover:text-neutral-900 hover:underline`
- No button UI - just inline text link
- Subtle, non-intrusive appearance
- Maintains clean timeline aesthetic

**Layout**:
- Positioned below subtitle (place/category)
- Margin top: `mt-1.5` (6px spacing)
- Flex layout with gap: `gap-1.5`
- Separator: `·` between price and action

### 5. Enhanced Share Text ✅
**Format**:
```
Сценарий дня — Суббота, 4 апреля, Минск
Для Таи и Степана

09:00 — Детский театр
  ул. Ленина, 10
  от 15 BYN · https://tickets.example.com

12:00 — Мастер-класс по рисованию
  Центр творчества, ул. Победы, 5
  Бесплатно

15:00 — Прогулка в парке
  Парк Горького

Собрано в mamaGo
```

**Implementation**:
- Added address line (indented with 2 spaces)
- Added price and link line (indented with 2 spaces)
- Empty line between items for readability
- Uses full URL for links (not shortened labels)

### 6. Address Display Enhancement ✅
**Change**:
- Subtitle now prioritizes full address over just place name
- Uses `formatActivityAddressLine()` helper
- Falls back to place name or category if no address

**Before**: "Детский театр" (place name only)
**After**: "ул. Ленина, 10" (full address)

## Technical Details

### New Imports
```typescript
import { resolveActivityParticipationCta } from "@/lib/plan/resolveActivityParticipationCta";
import { formatActivityAddressLine } from "../lib/formatActivityAddress";
```

### Helper Function
```typescript
function formatPrice(activity: NonNullable<PlanItemWithActivity["activity"]>): string | null
```

### Data Flow
1. Extract `activity` from `PlanItemWithActivity`
2. Call `formatPrice(activity)` → price string or null
3. Call `resolveActivityParticipationCta(activity, city)` → CTA object or null
4. Render combined line if either exists
5. Apply subtle styling

### Link Behavior
- External links: `target="_blank" rel="noopener noreferrer"`
- Internal links: Regular anchor (no target)
- Hover state: Underline + darker color
- No button styling - text link only

## Design Principles

### Visual Hierarchy
1. Time (bold, primary color) - most important
2. Title (semibold, dark) - main content
3. Address (regular, muted) - context
4. Price + Action (small, secondary) - actionable info
5. Image (thumbnail) - visual support

### Information Density
- Max 4 lines per item:
  - Line 1: Time
  - Line 2: Title
  - Line 3: Address/Place
  - Line 4: Price + Action
- Keeps timeline scannable
- No visual overload

### Interaction Design
- Subtle hover states
- No heavy buttons
- Text links feel lightweight
- Maintains "journey" feeling
- Not a "shopping list"

## Files Modified

1. `src/features/my-plan/components/DayScenarioModal.tsx`
   - Added imports for CTA and address helpers
   - Added `formatPrice()` helper function
   - Enhanced `generateShareText()` with address and price/link
   - Updated timeline item rendering with price and action line
   - Changed subtitle to prioritize address

## Acceptance Criteria

- [x] Price visible when exists
- [x] CTA visible when exists
- [x] No heavy buttons (text links only)
- [x] Timeline still clean and scannable
- [x] Combined format: "price · action →"
- [x] Subtle secondary styling
- [x] External links open in new tab
- [x] Share text includes price and links
- [x] Address shown instead of just place name
- [x] Max 3-4 lines per item
- [x] No visual overload

## Examples

### Timeline Item with Full Data
```
09:00
Детский театр "Сказка"
ул. Ленина, 10
от 15 BYN · Купить →
[thumbnail]
```

### Timeline Item with Booking
```
12:00
Мастер-класс по рисованию
Центр творчества, ул. Победы, 5
Бесплатно · Записаться →
[thumbnail]
```

### Timeline Item with Price Only
```
15:00
Прогулка в парке
Парк Горького
от 10 BYN
[thumbnail]
```

### Timeline Item Minimal
```
18:00
Ужин в кафе
ул. Немига, 3
[thumbnail]
```

## Future Enhancements (Optional)

- [ ] Add phone number support (tel: links)
- [ ] Add "Позвонить" action for phone-only activities
- [ ] Add duration estimates
- [ ] Add travel time between locations
- [ ] Add "Добавить в календарь" action
- [ ] Add social share buttons (WhatsApp, Telegram)

---

**Status**: Enhancement complete, ready for testing
**Date**: 2026-04-04
**Task**: Day Scenario Timeline - Price & Action Links
