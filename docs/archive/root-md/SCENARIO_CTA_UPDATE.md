# Scenario CTA Visibility Update Complete

## Overview
Updated the "Сценарий дня" button visibility logic to show only when the selected day contains 2 or more actual planned activities, making it a summary CTA rather than an empty-state action.

## Changes Made

### 1. Updated Visibility Logic

**Before:**
```typescript
const showFooterPrimaryButton = totalPlannedCount > 2;
// Shows only when 3+ items (too restrictive)
```

**After:**
```typescript
const canOpenDayScenario = useMemo(() => {
  return totalPlannedCount >= 2;
}, [totalPlannedCount]);
// Shows when 2+ items (appropriate threshold)
```

**Rationale:**
- 2 activities is the minimum for a meaningful "day scenario"
- Creates a timeline/narrative with at least 2 points
- More inclusive threshold (was 3+, now 2+)
- Clear semantic naming: `canOpenDayScenario` vs `showFooterPrimaryButton`

### 2. Updated Helper Text

**Before:**
```
"Вы сможете менять рекомендации в любой момент"
```
- Mentions recommendations (not relevant to scenario view)
- Focuses on editing capability
- Doesn't explain what scenario view is

**After:**
```
"Откройте красивый таймлайн собранного дня"
```
- Describes what user will see (timeline)
- Emphasizes visual appeal ("красивый")
- Focuses on viewing assembled day
- No mention of recommendations

### 3. Consistent Across Views

Both desktop and mobile views updated:
- Same visibility logic (`canOpenDayScenario`)
- Same helper text
- Same button styling
- Same placement (footer, after all content)

## Visibility Rules

### Show Button When:
- ✅ Selected day has 2 or more planned items
- ✅ Items are actual user-added activities
- ✅ Items are persisted or in current session

### Hide Button When:
- ❌ Selected day has 0 items
- ❌ Selected day has only 1 item
- ❌ Only recommendations/suggestions (not added to plan)
- ❌ Only empty placeholders

### Examples:

| Scenario | Planned Items | Show Button? |
|----------|---------------|--------------|
| Empty day | 0 | ❌ No |
| Morning activity only | 1 | ❌ No |
| Morning + Afternoon | 2 | ✅ Yes |
| Morning + Afternoon + Evening | 3 | ✅ Yes |
| All slots filled | 6+ | ✅ Yes |

## Button Placement

The button appears in the footer section:
1. After all time slots (morning/afternoon/evening)
2. After "Ещё идеи для этого дня" section
3. At the bottom of the scrollable content
4. Before any modals/sheets

This placement reinforces that it's a **summary action** for an assembled day, not a **starting action** for an empty day.

## User Experience Flow

### Scenario 1: Building a Day
1. User opens My Plan (empty)
2. No "Сценарий дня" button visible ✓
3. User adds first activity
4. Still no button (only 1 item) ✓
5. User adds second activity
6. "Сценарий дня" button appears ✓
7. User clicks button
8. Opens beautiful timeline view

### Scenario 2: Viewing Assembled Day
1. User opens My Plan (already has 3 activities)
2. "Сценарий дня" button visible immediately ✓
3. User clicks button
4. Opens timeline view of assembled day

### Scenario 3: Sparse Day
1. User opens My Plan (has 1 activity)
2. No "Сценарий дня" button ✓
3. Button doesn't clutter interface
4. User can still add more activities

## Code Quality Improvements

### Extracted Logic
```typescript
const canOpenDayScenario = useMemo(() => {
  return totalPlannedCount >= 2;
}, [totalPlannedCount]);
```

**Benefits:**
- Single source of truth for visibility logic
- Semantic naming (clear intent)
- Memoized for performance
- Easy to test
- Easy to modify threshold if needed

### Replaced Inline Condition
**Before:**
```tsx
{showFooterPrimaryButton ? (
  // Button JSX
) : null}
```

**After:**
```tsx
{canOpenDayScenario ? (
  // Button JSX
) : null}
```

More readable and self-documenting.

## Alternative Helper Text Options

We chose: **"Откройте красивый таймлайн собранного дня"**

Other options considered:
1. "Посмотрите, как будет выглядеть ваш день"
   - Good: Explains preview functionality
   - Con: Slightly longer

2. "Удобно для просмотра и отправки близким"
   - Good: Mentions sharing use case
   - Con: Assumes sharing feature exists

3. "Красивый таймлайн вашего дня"
   - Good: Concise
   - Con: Less actionable

**Chosen text wins because:**
- Actionable ("Откройте")
- Descriptive ("красивый таймлайн")
- Contextual ("собранного дня")
- Appropriate length
- Matches UI tone

## Files Modified

1. `src/features/my-plan/components/PlanMainContent.tsx`
   - Replaced `showFooterPrimaryButton` with `canOpenDayScenario`
   - Changed threshold from `> 2` to `>= 2`
   - Updated helper text in desktop footer
   - Updated helper text in mobile footer
   - Added semantic naming and memoization

## Testing Checklist

- [x] Button hidden when 0 items in plan
- [x] Button hidden when 1 item in plan
- [x] Button shown when 2 items in plan
- [x] Button shown when 3+ items in plan
- [x] Helper text updated to new version
- [x] Desktop and mobile views consistent
- [x] Button placement unchanged (footer)
- [x] Click behavior unchanged (opens scenario)
- [x] Logic is memoized for performance
- [x] Variable name is semantic and clear

## Impact Analysis

### Before Update
- Threshold: 3+ items (too restrictive)
- Users with 2 items couldn't access scenario view
- Helper text mentioned recommendations (confusing)
- Variable name was generic (`showFooterPrimaryButton`)

### After Update
- Threshold: 2+ items (appropriate)
- Users with 2 items can access scenario view
- Helper text describes timeline view (clear)
- Variable name is semantic (`canOpenDayScenario`)

### User Impact
- **More accessible**: Lower threshold means more users see the button
- **Clearer purpose**: Helper text explains what they'll see
- **Better UX**: Button appears at the right moment (when day has substance)

## Design Principles Applied

1. **Progressive Disclosure**
   - Button appears when it becomes relevant (2+ items)
   - Doesn't clutter empty state
   - Reveals functionality at the right time

2. **Contextual Actions**
   - Button is a summary action, not a starting action
   - Placement reinforces this (footer, after content)
   - Text emphasizes viewing assembled day

3. **Clear Communication**
   - Helper text describes what user will see
   - No jargon or technical terms
   - Focuses on benefit (beautiful timeline)

4. **Appropriate Thresholds**
   - 2 items is minimum for meaningful timeline
   - Not too restrictive (was 3+)
   - Not too permissive (not 1)

## Future Enhancements

1. **Dynamic Helper Text**
   - Show different text based on number of items
   - "2 активности → таймлайн"
   - "5 активностей → насыщенный день"

2. **Preview Thumbnail**
   - Small preview of timeline in button
   - Visual hint of what user will see

3. **Share Prompt**
   - After opening scenario, suggest sharing
   - "Отправить план близким?"

4. **Smart Threshold**
   - Adjust based on time of day
   - Morning: show with 1 item
   - Evening: require 2+ items

## Conclusion

The updated visibility logic makes the "Сценарий дня" button appear at the right moment—when the user has assembled enough activities to create a meaningful day timeline. The new helper text clearly communicates what the user will see, and the semantic naming makes the code more maintainable. The lower threshold (2+ vs 3+) makes the feature more accessible while still ensuring there's enough content for a useful scenario view.
