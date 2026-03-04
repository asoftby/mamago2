# Unified Age Range System - Complete

## Overview

Implemented a unified Age Range system for mamaGo that uses MONTHS as the source of truth for all age-related functionality.

## Age Ranges

```
0–1 год    → 0–12 months
1–3 года   → 12–36 months
3–5 лет    → 36–60 months
5–7 лет    → 60–84 months
7–9 лет    → 84–108 months
9–12 лет   → 108–144 months
12–14 лет  → 144–168 months
14–16 лет  → 168–192 months
16–18 лет  → 192–216 months
18+        → 216+ months (maxMonths: null)
```

## Database Fields

Already exist in the schema:
- `ageMinMonths: Int?` - Minimum age in months
- `ageMaxMonths: Int?` - Maximum age in months (null for 18+)
- `ageLabel: String?` - UI display label (comma-separated for multiple ranges)

## Files Created/Updated

### 1. Core Age System (`src/features/age/ageRanges.ts`) ✅ NEW
Central age mapping with:
- `AGE_RANGES` - Canonical age range definitions
- `getAgeRangeById(id)` - Get range by ID
- `convertAgeIdToMonths(id)` - Convert single ID to months
- `convertAgeIdsToRange(ids)` - Convert multiple IDs to combined range
- `getOverlappingAgeRanges(min, max)` - Find overlapping ranges
- `formatAgeRange(min, max)` - Format for display

### 2. Child Age Matching (`src/features/age/matchChildAge.ts`) ✅ NEW
Future-ready utilities for child-age matching:
- `matchChildAge(childAgeMonths, activity)` - Check if child matches activity
- `filterActivitiesByChildAge(activities, childAgeMonths)` - Filter activities
- `calculateAgeInMonths(birthDate)` - Calculate age from birth date

### 3. Filter Age Groups (`src/features/filters/age/ageGroups.ts`) ✅ UPDATED
Updated existing file to:
- Changed `maxMonths` type to `number | null` for 18+
- Updated 18+ range to have `maxMonths: null`
- Added `convertAgeGroupsToRange(values)` helper
- Updated `ageRangeOverlaps()` to handle null maxMonths

## Integration Points

### ✅ Discovery Filters (Already Integrated)
The discovery filters already use `AGE_GROUPS` from `src/features/filters/age/ageGroups.ts`:
- Multi-select age filter
- Stored as array of IDs in URL: `?age=0-1,1-3,3-5`
- Converted to months range for filtering

### 🔄 Activity Creation Forms (Next Step)
To integrate in Activity/Event/Place forms:

```tsx
import { AGE_GROUPS, convertAgeGroupsToRange } from '@/features/filters/age/ageGroups';

// In form state
const [selectedAges, setSelectedAges] = useState<string[]>([]);

// Render checkboxes
{AGE_GROUPS.map((group) => (
  <Checkbox
    key={group.value}
    checked={selectedAges.includes(group.value)}
    onCheckedChange={(checked) => {
      if (checked) {
        setSelectedAges([...selectedAges, group.value]);
      } else {
        setSelectedAges(selectedAges.filter(v => v !== group.value));
      }
    }}
  >
    {group.label}
  </Checkbox>
))}

// On submit, convert to months
const ageRange = convertAgeGroupsToRange(selectedAges);
if (ageRange) {
  formData.ageMinMonths = ageRange.minMonths;
  formData.ageMaxMonths = ageRange.maxMonths;
  formData.ageLabel = ageRange.label;
}
```

### 🔄 Activity Cards (Next Step)
Display age label on cards:

```tsx
import { formatAgeRange } from '@/features/age/ageRanges';

// In ActivityCard component
{activity.ageMinMonths !== null && (
  <div className="flex items-center gap-1 text-sm text-muted-foreground">
    <Baby className="h-4 w-4" />
    <span>{activity.ageLabel || formatAgeRange(activity.ageMinMonths, activity.ageMaxMonths)}</span>
  </div>
)}
```

### 🔄 Filtering Logic (Next Step)
Filter activities by age overlap:

```tsx
import { convertAgeGroupsToRange } from '@/features/filters/age/ageGroups';

// Convert selected age IDs to range
const ageRange = convertAgeGroupsToRange(selectedAgeIds);

if (ageRange) {
  // Filter activities
  const filtered = activities.filter((activity) => {
    if (!activity.ageMinMonths || !activity.ageMaxMonths) return true;
    
    // Check overlap: activity.min <= filter.max AND activity.max >= filter.min
    const maxOverlaps = ageRange.maxMonths === null || activity.ageMinMonths <= ageRange.maxMonths;
    const minOverlaps = ageRange.maxMonths === null || activity.ageMaxMonths >= ageRange.minMonths;
    
    return maxOverlaps && minOverlaps;
  });
}
```

## Data Flow

### Activity Creation
```
User selects: [0–1, 1–3, 3–5]
↓
convertAgeGroupsToRange(["0-1", "1-3", "3-5"])
↓
{
  minMonths: 0,
  maxMonths: 60,
  label: "0–1 год, 1–3 года, 3–5 лет"
}
↓
Save to DB:
  ageMinMonths: 0
  ageMaxMonths: 60
  ageLabel: "0–1 год, 1–3 года, 3–5 лет"
```

### Discovery Filtering
```
User selects: [3–5, 5–7]
↓
convertAgeGroupsToRange(["3-5", "5-7"])
↓
{
  minMonths: 36,
  maxMonths: 84
}
↓
Filter activities where:
  activity.ageMinMonths <= 84
  AND activity.ageMaxMonths >= 36
```

### Child Matching (Future)
```
Child birth date: 2021-01-15
↓
calculateAgeInMonths(birthDate) → 48 months
↓
matchChildAge(48, activity)
↓
Check: 48 >= activity.ageMinMonths
  AND (activity.ageMaxMonths === null OR 48 <= activity.ageMaxMonths)
```

## Key Features

1. **Months as Source of Truth** ✅
   - All age logic uses months internally
   - Labels are for UI display only

2. **Open-Ended Range Support** ✅
   - 18+ has `maxMonths: null`
   - Properly handled in all helpers

3. **Multi-Select Support** ✅
   - Users can select multiple age ranges
   - Automatically computes MIN/MAX

4. **Overlap Logic** ✅
   - Filters activities that overlap with selected ranges
   - Handles null maxMonths correctly

5. **Future-Ready** ✅
   - Child age matching utilities ready
   - Age calculation from birth date

## Testing Checklist

- [x] AGE_GROUPS defined with correct month ranges
- [x] 18+ has maxMonths: null
- [x] getAgeGroupByValue() works
- [x] convertAgeGroupsToRange() combines multiple ranges
- [x] convertAgeGroupsToRange() handles 18+ (null maxMonths)
- [x] ageRangeOverlaps() handles null maxMonths
- [x] matchChildAge() utility created
- [x] calculateAgeInMonths() utility created
- [ ] Activity form integrates age selection (TODO)
- [ ] Activity cards display age label (TODO)
- [ ] Discovery filters use age overlap logic (TODO)

## Next Steps

1. **Integrate into Activity Forms**
   - Add age selection UI with checkboxes
   - Convert selected ages to months on submit
   - Save to ageMinMonths, ageMaxMonths, ageLabel

2. **Update Activity Cards**
   - Display ageLabel or formatted range
   - Add age icon (Baby/Users)

3. **Update Discovery Filter Logic**
   - Use convertAgeGroupsToRange() to get filter range
   - Apply overlap logic in activity queries

4. **Add to Admin Forms**
   - Same age selection UI for admin activity creation

## Status: ✅ CORE SYSTEM COMPLETE

The unified age range system is implemented and ready for integration. The core utilities are in place, and the existing discovery filters already use the AGE_GROUPS structure.

Next: Integrate age selection into activity creation forms and update filtering logic.
