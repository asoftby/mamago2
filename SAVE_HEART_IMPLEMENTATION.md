# SaveHeart Implementation - Complete ✅

## Overview
Implemented single SaveHeart control on ActivityCard with smart scheduling modal that adapts based on activity sessions. Users can save activities as ideas or schedule them to their plan.

## Components

### SaveHeart Component
**File**: `src/features/save/SaveHeart.tsx`

**Purpose**: Single heart icon control that manages save state and opens scheduling modal

**Features**:
- Heart icon (outline when not saved, filled when saved)
- Checks save status on mount via API
- Opens ScheduleModal when clicked (if not already saved)
- Handles both idea saving and plan scheduling
- Smooth animations on save
- Prevents duplicate saves

**Props**:
- `activityId` - Activity identifier
- `activityTitle` - Activity name for modal display
- `sessions` - Array of available session dates
- `className` - Optional styling
- `onSaveChange` - Optional callback when save state changes

**States**:
- Outline: Not saved (no Idea or PlanItem exists)
- Filled: Saved (Idea or PlanItem exists)

### ScheduleModal Component
**File**: `src/features/save/ScheduleModal.tsx`

**Purpose**: Smart modal that adapts UI based on number of sessions

**Behavior by Session Count**:

#### 0 Sessions (No specific dates)
- Primary button: "Сохранить в идеи"
- Secondary button: "Запланировать" (opens date picker)

#### 1 Session (Single date available)
- Primary button: "Запланировать на <date>" (e.g., "понедельник, 10 марта")
- Secondary button: "Выбрать другую дату" (opens date picker)
- Link: "Сохранить в идеи"

#### Multiple Sessions (2+ dates)
- Shows list of dates sorted ascending
- Each date is clickable button with formatted date/time
- Link: "Сохранить в идеи"

**Features**:
- Modal backdrop with click-to-close
- Close button in header
- Custom date picker for manual scheduling
- Loading states during API calls
- Proper date/time formatting in Russian
- Responsive design

## API Routes

### POST /api/save/idea
**Purpose**: Add activity to user's saved ideas

**Request**:
```json
{
  "activityId": "string"
}
```

**Response**:
```json
{
  "success": true,
  "idea": { ... }
}
```

### DELETE /api/save/idea
**Purpose**: Remove activity from user's saved ideas

**Query Params**: `activityId`

### POST /api/save/plan
**Purpose**: Schedule activity to user's plan

**Request**:
```json
{
  "activityId": "string",
  "date": "YYYY-MM-DD",
  "startsAt": "ISO string (optional)"
}
```

**Response**:
```json
{
  "success": true,
  "planItem": { ... }
}
```

### DELETE /api/save/plan
**Purpose**: Remove plan item

**Query Params**: `planItemId`

### GET /api/save/status
**Purpose**: Check if activity is saved

**Query Params**: `activityId`

**Response**:
```json
{
  "isSaved": boolean,
  "isIdea": boolean,
  "inPlan": boolean,
  "planItemCount": number
}
```

### GET /api/save/ideas
**Purpose**: List all user's saved ideas

**Response**:
```json
{
  "ideas": [...]
}
```

## Integration

### ActivityCard
**File**: `src/components/activity/ActivityCard.tsx`

**Changes**:
- Replaced `FavoriteButton` with `SaveHeart`
- Removed old localStorage-based favorites logic
- Builds sessions array from `dateStart` field
- Passes activity ID and title to SaveHeart

**Session Building**:
```typescript
const sessions = base.dateStart
  ? [{ date: new Date(base.dateStart).toISOString().split("T")[0] }]
  : [];
```

### /me/ideas Page
**File**: `src/app/(public)/me/ideas/page.tsx`

**Current State**:
- Server-side rendered
- Displays list of saved ideas
- Shows activity ID and save date
- No interactive buttons yet (future: add "Запланировать" button)

### /me/plan Page
**File**: `src/app/(public)/me/plan/page.tsx`

**Integration**:
- Already loads plan items from database
- Displays scheduled activities by date
- After scheduling via SaveHeart, items appear here automatically

## User Flow

### Saving an Activity
1. User clicks heart icon on ActivityCard
2. SaveHeart opens ScheduleModal
3. User chooses:
   - Save as idea (for later)
   - Schedule to specific date
4. API call creates Idea or PlanItem
5. Heart fills, modal closes
6. Item appears in /me/ideas or /me/plan

### Scheduling from Ideas
(Future enhancement - not yet implemented)
1. User goes to /me/ideas
2. Clicks "Запланировать" button on idea
3. Opens same ScheduleModal
4. User selects date
5. Creates PlanItem
6. Item appears in /me/plan

## Design Principles

### Single Source of Truth
✅ ONE SaveHeart component used everywhere
✅ ONE ScheduleModal component for all scheduling
✅ No duplicate save logic across codebase

### Smart Adaptation
✅ Modal adapts to session count automatically
✅ Primary action changes based on context
✅ Date picker only shown when needed

### Minimal UI
✅ Reuses existing Button primitives
✅ Clean modal design
✅ No custom one-off styles
✅ Consistent with design system

## Files Created
- `src/features/save/SaveHeart.tsx`
- `src/features/save/ScheduleModal.tsx`
- `src/app/api/save/idea/route.ts`
- `src/app/api/save/plan/route.ts`
- `src/app/api/save/status/route.ts`
- `src/app/api/save/ideas/route.ts`

## Files Modified
- `src/components/activity/ActivityCard.tsx` (replaced FavoriteButton with SaveHeart)

## Verification
✅ TypeScript diagnostics pass (0 errors)
✅ Build succeeds with no warnings
✅ All API routes registered
✅ Modal adapts to session count
✅ Save state persists across page loads
✅ Plan items appear in /me/plan after scheduling

## Technical Details

### Save State Detection
- Checks both Idea and PlanItem tables
- Returns `isSaved: true` if either exists
- Prevents duplicate saves

### Date Formatting
- Uses Russian locale for all dates
- Formats: "понедельник, 10 марта" (full)
- Time: "14:00" (24-hour format)
- Sorts sessions chronologically

### Security
- All API routes check authentication
- User ownership verified on delete operations
- Activity IDs validated

### Performance
- Save status checked once on mount
- Optimistic UI updates (heart fills immediately)
- Modal lazy-loaded (only when needed)

## Not Implemented (Future)

### Ideas Page Enhancement
- Add "Запланировать" button to each idea card
- Reuse same ScheduleModal
- Remove from ideas after scheduling (optional)

### Unsave Functionality
- Click filled heart to unsave
- Show confirmation modal
- Remove from Idea or PlanItem

### Activity Details
- Fetch and display actual activity data (not just IDs)
- Show images, descriptions in modal
- Link to activity detail page

### Multiple Scheduling
- Schedule same activity to multiple dates
- Recurring events support
- Bulk operations

### Notifications
- Remind user of upcoming plan items
- Suggest scheduling saved ideas

## Usage Examples

### Basic Usage
```tsx
<SaveHeart
  activityId="activity-123"
  activityTitle="Детский мастер-класс"
  sessions={[
    { date: "2026-03-10", startsAt: "2026-03-10T14:00:00Z" },
    { date: "2026-03-17", startsAt: "2026-03-17T14:00:00Z" }
  ]}
/>
```

### No Sessions
```tsx
<SaveHeart
  activityId="activity-456"
  activityTitle="Постоянная услуга"
  sessions={[]}
/>
```

### With Callback
```tsx
<SaveHeart
  activityId="activity-789"
  activityTitle="Событие"
  sessions={[{ date: "2026-03-15" }]}
  onSaveChange={(isSaved) => {
    console.log("Save state changed:", isSaved);
  }}
/>
```

## Next Steps
1. Add "Запланировать" button to /me/ideas cards
2. Implement unsave functionality
3. Fetch and display actual activity data
4. Add activity images to modal
5. Implement plan item editing/rescheduling
6. Add notifications for upcoming events
