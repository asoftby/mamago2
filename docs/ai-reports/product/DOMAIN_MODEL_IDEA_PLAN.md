# Domain Model Implementation - Idea & PlanItem ✅

## Overview
Implemented minimal Idea and PlanItem domain models with services and connected them to /me pages for data persistence and display.

## Database Models

### Idea Model
**Purpose**: User saved ideas (activities they want to remember)

**Schema**:
```prisma
model Idea {
  id         String @id @default(cuid())
  userId     String
  activityId String
  user       User @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  
  @@unique([userId, activityId])
  @@index([userId])
}
```

**Fields**:
- `id` - Unique identifier
- `userId` - Owner of the idea
- `activityId` - Reference to activity (not FK, flexible)
- `createdAt` - When idea was saved

**Constraints**:
- Unique constraint on (userId, activityId) - prevents duplicates
- Cascade delete when user is deleted

### PlanItem Model
**Purpose**: Activities scheduled for specific dates

**Schema**:
```prisma
model PlanItem {
  id         String    @id @default(cuid())
  userId     String
  activityId String
  date       String    // YYYY-MM-DD format
  startsAt   DateTime? // Optional specific time
  user       User @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  
  @@index([userId, date])
  @@index([userId])
}
```

**Fields**:
- `id` - Unique identifier
- `userId` - Owner of the plan item
- `activityId` - Reference to activity (not FK, flexible)
- `date` - Date in YYYY-MM-DD format (string for easy querying)
- `startsAt` - Optional specific time for the activity
- `createdAt` - When plan item was created

**Design Decisions**:
- `date` is String (YYYY-MM-DD) not DateTime for simpler day-based queries
- Represents ONE specific day (no date ranges)
- `startsAt` is optional - user can schedule without specific time
- Idea and PlanItem are independent (no relationship between them)

## Migration
**File**: `prisma/migrations/20260303134215_add_idea_and_plan_item_models/migration.sql`

Applied successfully with:
```bash
pnpm prisma migrate dev --name add_idea_and_plan_item_models
```

## Services

### IdeaService
**File**: `src/server/services/idea.service.ts`

**Functions**:

1. `addIdea(userId, activityId): Promise<Idea>`
   - Adds activity to user's saved ideas
   - Idempotent - uses upsert, won't fail if already exists
   - Returns the Idea record

2. `removeIdea(userId, activityId): Promise<void>`
   - Removes activity from user's saved ideas
   - Idempotent - uses deleteMany, won't fail if doesn't exist

3. `listIdeas(userId): Promise<Idea[]>`
   - Lists all saved ideas for a user
   - Ordered by creation date (newest first)

4. `hasIdea(userId, activityId): Promise<boolean>`
   - Checks if user has saved a specific activity
   - Useful for UI state (heart icon filled/unfilled)

### PlanService
**File**: `src/server/services/plan.service.ts`

**Functions**:

1. `addPlanItem(userId, activityId, date, startsAt?): Promise<PlanItem>`
   - Adds activity to user's plan for specific date
   - `date` in YYYY-MM-DD format
   - `startsAt` is optional DateTime

2. `removePlanItem(userId, planItemId): Promise<void>`
   - Removes plan item by ID
   - Security: ensures user owns the plan item

3. `listPlanItemsByWeek(userId, weekStartDate): Promise<PlanItem[]>`
   - Lists plan items for 7-day period starting from weekStartDate
   - Calculates end date automatically (start + 6 days)
   - Ordered by date, then startsAt

4. `listPlanItemsByDate(userId, date): Promise<PlanItem[]>`
   - Lists all plan items for specific date
   - Ordered by startsAt

5. `groupPlanItemsByDate(planItems): Record<string, PlanItem[]>`
   - Groups plan items by date for easy rendering
   - Returns object with date strings as keys

6. `getCurrentWeekStart(): string`
   - Gets Monday of current week
   - Returns YYYY-MM-DD format
   - Handles Sunday correctly (returns previous Monday)

## UI Integration

### /me/ideas Page
**File**: `src/app/(public)/me/ideas/page.tsx`

**Changes**:
- Loads ideas from database using `listIdeas()`
- Displays list of saved ideas with activity ID and save date
- Shows empty state if no ideas
- Minimal UI - just displays data (no delete/edit yet)

**Display**:
- Each idea shows: Activity ID, save date
- Ordered by newest first
- Uses existing Surface and Body components

### /me/plan Page
**File**: `src/app/(public)/me/plan/page.tsx`

**Changes**:
- Loads plan items for current week using `listPlanItemsByWeek()`
- Groups items by date using `groupPlanItemsByDate()`
- Displays week calendar header with day names and item counts
- Shows plan items grouped by date
- Empty state if no plan items

**Week Calendar Header**:
- 7-column grid (Mon-Sun)
- Shows day name (short), day number
- Shows count of items for each day
- Highlights days with activities

**Plan Items Display**:
- Grouped by date with date label (e.g., "понедельник, 3 марта")
- Each item shows: Activity ID, optional start time
- Only shows dates that have items
- Ordered chronologically

**Preserved Features**:
- Onboarding card for users without children
- Empty state with CTA to browse events

## Design Principles

### Domain Focus
✅ Focused on data models and services
✅ Minimal UI changes - just display data
✅ No new visual patterns
✅ Reused existing components (Surface, Body, H1)

### Service Layer
✅ Clean separation of concerns
✅ Idempotent operations where appropriate
✅ Security checks (user ownership)
✅ Utility functions for common operations

### Data Integrity
✅ Unique constraints prevent duplicates
✅ Cascade deletes maintain referential integrity
✅ Indexes for query performance
✅ String date format for simple queries

## Files Created
- `prisma/migrations/20260303134215_add_idea_and_plan_item_models/migration.sql`
- `src/server/services/idea.service.ts`
- `src/server/services/plan.service.ts`

## Files Modified
- `prisma/schema.prisma` (added Idea and PlanItem models)
- `src/app/(public)/me/ideas/page.tsx` (connected to database)
- `src/app/(public)/me/plan/page.tsx` (connected to database, week view)

## Verification
✅ TypeScript diagnostics pass (0 errors)
✅ Build succeeds with no warnings
✅ Migration applied successfully
✅ Prisma Client regenerated
✅ Services follow consistent patterns
✅ UI displays data from database

## Not Implemented (Future)
- SaveHeart component (add to ideas from activity cards)
- Modal for adding plan items
- Edit/delete actions in UI
- Activity details in plan/ideas (currently just IDs)
- Week navigation (prev/next week)
- Drag & drop for plan items
- Notifications/reminders

## Usage Examples

### Adding an Idea
```typescript
import { addIdea } from "@/server/services/idea.service";
await addIdea(userId, activityId);
```

### Adding to Plan
```typescript
import { addPlanItem } from "@/server/services/plan.service";
await addPlanItem(userId, activityId, "2026-03-10", new Date("2026-03-10T14:00:00"));
```

### Loading Week Plan
```typescript
import { listPlanItemsByWeek, getCurrentWeekStart } from "@/server/services/plan.service";
const weekStart = getCurrentWeekStart();
const items = await listPlanItemsByWeek(userId, weekStart);
```

## Next Steps
1. Add API routes for idea/plan operations
2. Implement SaveHeart component on activity cards
3. Add modal for scheduling activities to plan
4. Fetch and display actual activity data (not just IDs)
5. Add remove/edit actions in UI
6. Implement week navigation
