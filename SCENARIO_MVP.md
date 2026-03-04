# Day Scenario MVP - Complete ✅

## Overview
Implemented simple Day Scenario feature that generates an ordered list of PlanItems for a specific date, accessible from the plan page.

## Concept
**Scenario** = Ordered list of PlanItems for a specific date, sorted by time or creation order.

## Route

### /me/day/[date]
**File**: `src/app/(public)/me/day/[date]/page.tsx`

**Purpose**: Display scenario (ordered activities) for a specific date

**URL Format**: `/me/day/YYYY-MM-DD` (e.g., `/me/day/2026-03-10`)

**Features**:
- Validates date format (YYYY-MM-DD)
- Loads plan items for the specified date
- Sorts items intelligently
- Displays numbered list
- Shows empty state if no items
- Back link to plan page

## Sorting Logic

Items are sorted by:
1. **Primary**: `startsAt` time (if available)
   - Items with specific times come first
   - Sorted chronologically by time
2. **Secondary**: Creation time
   - Items without specific times sorted by when they were added
3. **Fallback**: Items without `startsAt` appear after timed items

**Implementation**:
```typescript
const sortedItems = [...planItems].sort((a, b) => {
  if (a.startsAt && b.startsAt) {
    return a.startsAt.getTime() - b.startsAt.getTime();
  }
  if (a.startsAt) return -1;
  if (b.startsAt) return 1;
  return a.createdAt.getTime() - b.createdAt.getTime();
});
```

## UI Components

### Scenario Page Layout
- **Header**: "Сценарий на <date>" (e.g., "Сценарий на понедельник, 10 марта 2026")
- **Back Link**: "← Вернуться к плану"
- **Item List**: Numbered cards with activity details
- **Empty State**: "На этот день ничего не запланировано" + CTA to browse events

### Item Card
- **Number Badge**: Circular badge with sequence number (1, 2, 3...)
- **Activity ID**: Currently shows activity ID (future: full activity details)
- **Time**: Shows start time if available (e.g., "Время: 14:00")

## Plan Page Integration

### Week Calendar Enhancement
**File**: `src/app/(public)/me/plan/page.tsx`

**Changes**:
1. **Clickable Days**: Each day in week calendar is now a link
   - Hover effect shows interactivity
   - Clicking opens scenario for that date
   - Item count badge remains visible

2. **Date Section Links**: Each date section has "Сценарий →" link
   - Positioned next to date heading
   - Quick access to full scenario view

**User Flow**:
1. User views `/me/plan` (week overview)
2. Sees days with item counts
3. Clicks on a day OR clicks "Сценарий →" link
4. Opens `/me/day/YYYY-MM-DD`
5. Views ordered scenario for that day
6. Can return to plan via back link

## Technical Details

### Date Validation
- Validates YYYY-MM-DD format using regex
- Redirects to plan page if invalid format
- Prevents malformed URLs

### Date Formatting
- Uses Russian locale for all dates
- Full format: "понедельник, 10 марта 2026"
- Time format: "14:00" (24-hour)
- Capitalized weekday names

### Data Loading
- Uses existing `listPlanItemsByDate()` service
- Server-side rendering (no client-side fetching)
- Efficient single query per date

### Empty State
- Shows when no items for date
- Provides CTA to browse events
- Maintains consistent UX with plan page

## Files Created
- `src/app/(public)/me/day/[date]/page.tsx`

## Files Modified
- `src/app/(public)/me/plan/page.tsx` (added links to scenario pages)

## Verification
✅ TypeScript diagnostics pass (0 errors)
✅ Build succeeds with no warnings
✅ Route registered: `/me/day/[date]`
✅ Links work from plan page
✅ Sorting logic correct
✅ Empty state displays properly

## User Experience

### Viewing a Scenario
1. User has scheduled 3 activities for Monday:
   - Activity A at 10:00
   - Activity B at 14:00
   - Activity C (no specific time)

2. Scenario page shows:
   ```
   1. Activity A - Время: 10:00
   2. Activity B - Время: 14:00
   3. Activity C
   ```

3. User sees clear sequence for the day

### Empty Day
1. User clicks on a day with no items
2. Sees: "На этот день ничего не запланировано"
3. Can click "Найти мероприятия" to browse
4. Or return to plan to view other days

## Not Implemented (Future)

### Travel Time Logic
- Calculate time between activities
- Show travel duration
- Suggest optimal order based on location
- Warn about conflicts

### Route Optimization
- Reorder activities for efficiency
- Consider location proximity
- Minimize travel time
- Suggest alternative times

### Activity Details
- Show full activity information (not just ID)
- Display images, descriptions
- Show venue/location
- Add map integration

### Scenario Actions
- Reorder items (drag & drop)
- Remove items from scenario
- Add notes to items
- Share scenario with others
- Export to calendar

### Smart Suggestions
- Suggest activities to fill gaps
- Recommend nearby activities
- Consider child's interests
- Weather-based suggestions

### Scenario Templates
- Save scenarios as templates
- Reuse for similar days
- Share templates with community
- Browse popular scenarios

## Design Principles

### Minimal & Clean
✅ No complex routing optimization
✅ Simple sorting logic
✅ Clean UI with numbered list
✅ Consistent with existing design

### Progressive Enhancement
✅ Basic functionality works now
✅ Foundation for future features
✅ Easy to add travel time later
✅ Extensible architecture

### User-Centric
✅ Clear visual hierarchy
✅ Easy navigation (back link)
✅ Helpful empty states
✅ Intuitive interaction

## Usage Example

### Creating a Day Scenario
1. User saves 3 activities to plan:
   ```
   POST /api/save/plan
   { activityId: "A", date: "2026-03-10", startsAt: "2026-03-10T10:00:00Z" }
   
   POST /api/save/plan
   { activityId: "B", date: "2026-03-10", startsAt: "2026-03-10T14:00:00Z" }
   
   POST /api/save/plan
   { activityId: "C", date: "2026-03-10" }
   ```

2. User goes to `/me/plan`
3. Sees Monday with "3" badge
4. Clicks on Monday
5. Opens `/me/day/2026-03-10`
6. Sees ordered scenario:
   - 1. Activity A (10:00)
   - 2. Activity B (14:00)
   - 3. Activity C

### Navigating Scenarios
1. From plan page, click any day
2. View scenario for that day
3. Click "← Вернуться к плану"
4. Back to week overview
5. Click different day
6. View different scenario

## Next Steps
1. Fetch and display actual activity data (not just IDs)
2. Add activity images to scenario cards
3. Implement travel time calculation
4. Add route optimization
5. Enable scenario editing (reorder, remove)
6. Add map view of scenario
7. Implement scenario sharing
8. Add calendar export
