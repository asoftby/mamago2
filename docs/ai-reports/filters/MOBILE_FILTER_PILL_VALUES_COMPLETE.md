# Mobile Filter Pill Multi-Category Summary

## Status: ✅ Complete

## Overview
Enhanced mobile filter pill to show up to 2 categories with special age handling rules and removed the separate reset button.

## Changes Made

### File: `src/features/filters/discovery/DiscoveryFilters.tsx`

#### Mobile Pill Behavior

**Label Logic:**
- No filters active: `"Фильтры"`
- Filters active: `"Выбрано"`

**Value Logic:**
- No filters: `"Выберите..."`
- Shows up to 2 categories in stable priority order
- If more than 2 categories active, appends `+N` where N = hidden category count

#### Category Priority (Stable)
1. **When** (date/preset)
2. **Age**
3. **Metro**
4. **District**

#### Special Age Handling Rules

**When ONLY age is selected (no other categories):**
- 1 age: "9–12 лет"
- 2 ages: "9–12 лет, 12–14 лет"
- 3+ ages: "9–12 лет, 12–14 лет +1"

**When age + any other category:**
- 1 age: "9–12 лет"
- 2+ ages: "9–12 лет +1" (collapsed format)

#### Formatting Rules

**When (Date/Preset):**
- `TODAY` → "Сегодня"
- `TOMORROW` → "Завтра"
- `WEEKEND` → "На выходных"
- Single date → "5 мар."
- Same month range → "5–9 мар."
- Different months → "5 мар.–15 апр."

**Age:**
- Uses special rules above based on whether other categories are active

**Metro/District:**
- Shows option label from resolved options

**Multiple Categories:**
- Shows first 2 categories joined by ", "
- If more than 2 active, appends ` +N` where N = number of hidden categories

#### Reset Button Removed
- Removed the separate X reset button that appeared next to the pill on mobile
- Reset functionality remains inside MobileFilterSheet

## Implementation Details

### Helper Functions
- `fmtShortRu(dateStr)` - Formats YYYY-MM-DD to "5 мар."
- `buildWhenLabel()` - Builds date/preset label
- `buildAgeLabel()` - Builds age label with special rules based on other categories
- `resolveOptionLabel()` - Resolves option value to label

### Variables Computed
- `whenActive`, `ageActive`, `metroActive`, `districtActive` - Boolean flags for active categories
- `otherCategoriesActive` - Whether any category besides age is active
- `whenLabel`, `ageLabel`, `metroLabel`, `districtLabel` - Formatted labels
- `cats` - Array of active categories in priority order
- `visible` - First 2 categories to show
- `hiddenCount` - Number of hidden categories
- `mobilePillLabel` - Dynamic label ("Фильтры" or "Выбрано")
- `mobilePillValue` - Formatted value string with up to 2 categories

## Examples

| Filters Active | Label | Value |
|---|---|---|
| None | Фильтры | Выберите... |
| 1 age only | Выбрано | 9–12 лет |
| 2 ages only | Выбрано | 9–12 лет, 12–14 лет |
| 3 ages only | Выбрано | 9–12 лет, 12–14 лет +1 |
| Today only | Выбрано | Сегодня |
| Today + 1 age | Выбрано | Сегодня, 9–12 лет |
| Today + 2 ages | Выбрано | Сегодня, 9–12 лет +1 |
| Today + 3 ages | Выбрано | Сегодня, 9–12 лет +2 |
| Today + age + metro | Выбрано | Сегодня, 9–12 лет +1 |
| Today + age + metro + district | Выбрано | Сегодня, 9–12 лет +2 |
| Metro only | Выбрано | Площадь Победы |
| Metro + district | Выбрано | Площадь Победы, Центральный |
| Age + metro | Выбрано | 9–12 лет, Площадь Победы |
| 2 ages + metro | Выбрано | 9–12 лет +1, Площадь Победы |

## Technical Notes

- Uses local Russian month names array (no external dependencies)
- Desktop behavior unchanged
- MobileFilterSheet behavior unchanged
- Priority is stable and deterministic (not based on selection order)
- All date parsing includes error handling with fallbacks
- Age label logic checks if other categories are active to determine format
- Hidden count represents number of categories, not number of values

## UI Changes

- Removed separate X reset button on mobile (was next to pill)
- Reset functionality still available inside MobileFilterSheet
- Cleaner mobile UI with single pill button

## Testing

✅ Compiles without errors
✅ No TypeScript diagnostics
✅ Server running successfully
✅ Mobile-only changes (desktop unaffected)
✅ Special age handling working correctly

## Related Files
- `src/features/filters/discovery/DiscoveryFilters.tsx` - Main implementation
- `src/components/discovery/FilterFieldPill.tsx` - Pill component (unchanged)
- `src/features/filters/discovery/filters.store.ts` - Store (unchanged)
- `src/components/discovery/MobileFilterSheet.tsx` - Sheet (unchanged)
