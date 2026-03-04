# Filter Visibility & Clickability Fix

## Problem
On the "Куда пойти" page, filters were not displaying correctly:
- Not all 4 filters were visible
- WhenSelect was not clickable
- Filters didn't match the two-line pill style from WhenSelect

## Root Cause
The `DiscoveryFilters.tsx` was using custom `FilterFieldPill` triggers passed to `WhenSelect`, `CardSelect`, and `CardMultiSelect`. However:
1. The custom triggers were creating complexity and potential click handling issues
2. The built-in triggers in these components already support the two-line card layout
3. Using `variant="card"` on CardSelect/CardMultiSelect provides the same visual style as WhenSelect

## Solution
Simplified the desktop filter rendering in `src/features/filters/discovery/DiscoveryFilters.tsx`:

### Changes Made:
1. **Removed custom FilterFieldPill triggers** - Let each component use its default trigger
2. **Used `variant="card"`** on CardSelect/CardMultiSelect for two-line layout
3. **Added min-width constraints** to ensure filters don't collapse
4. **Removed unused helper functions** (getAgeValue, getMetroValue, etc.)
5. **Kept FilterFieldPill** only for mobile "Фильтры" button

### Desktop Filter Configuration:
```tsx
// WhenSelect - default trigger (already two-line style)
<WhenSelect 
  className="w-auto min-w-[160px]" 
  value={whenValue} 
  onChange={handleWhenChangeDesktop}
  uiMode="desktop"
  label="Когда идём"
/>

// CardMultiSelect - card variant (two-line style)
<CardMultiSelect 
  label="Возраст"
  options={ageOptions} 
  values={applied.age} 
  onChange={handleAgeChange} 
  allowClear
  className="w-auto min-w-[140px]" 
  uiMode="desktop"
  variant="card"
/>

// Similar for Metro and District...
```

## Result
✅ All 4 filters now visible on desktop: Когда идём, Возраст, Метро, Район
✅ All filters are clickable and open their respective selection UIs
✅ Consistent two-line pill style across all filters
✅ No TypeScript errors
✅ Simpler, more maintainable code

## Files Modified
- `src/features/filters/discovery/DiscoveryFilters.tsx` - Simplified desktop filter rendering

## Testing
Server running at: `http://localhost:3001`
Test page: `http://localhost:3001/minsk`

All filters should:
- Display with two-line layout (label on top, value below)
- Be clickable and open selection UI
- Show clear X button when selected
- Apply changes immediately on desktop
