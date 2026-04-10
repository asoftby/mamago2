# Business Activity Creation - Complete ✅

## Overview
Implemented activity creation and management for BUSINESS_OWNER role with reusable form architecture that can later be used by EDITOR role.

## Database Changes

### Activity Model Extensions
**Migration**: `20260303135017_add_business_activity_fields`

**New Fields**:
- `businessId` - Optional link to business (null for admin-created activities)
- `createdBy` - User ID who created the activity
- `coverImageUrl` - Image URL for activity cover
- `priceFrom` - Starting price
- `currency` - Currency code (default: "BYN")
- `ageLabel` - Human-readable age label (e.g., "6+", "3-7 лет")

### ActivitySession Model (New)
**Purpose**: Store specific dates/times when activity happens

**Fields**:
- `id` - Unique identifier
- `activityId` - Parent activity
- `startsAt` - DateTime when session starts
- `createdAt` - Creation timestamp

**Indexes**:
- `activityId` - For efficient session lookup
- `startsAt` - For date-based queries

## Service Layer

### ActivityService
**File**: `src/server/services/activity.service.ts`

**Functions**:

1. `createActivity(input): Promise<ActivityWithSessions>`
   - Creates activity with optional sessions
   - Returns activity with sessions included

2. `updateActivity(activityId, input): Promise<ActivityWithSessions>`
   - Updates activity fields
   - Replaces all sessions if provided
   - Returns updated activity with sessions

3. `getActivityById(activityId): Promise<ActivityWithSessions | null>`
   - Fetches activity with sessions
   - Sessions ordered by startsAt ascending

4. `listBusinessActivities(businessId): Promise<ActivityWithSessions[]>`
   - Lists all activities for a business
   - Ordered by creation date descending

5. `deleteActivity(activityId): Promise<void>`
   - Deletes activity and cascades to sessions

6. `canManageActivity(userId, activityId): Promise<boolean>`
   - Checks if user can manage activity
   - Returns true if user created it or owns the business

**Security**:
- Business owners can only manage their own activities
- Checks both `createdBy` and business ownership
- Used in all API routes for authorization

## Shared Form Component

### ActivityForm
**File**: `src/features/activity/forms/ActivityForm.tsx`

**Purpose**: Reusable form for creating/editing activities

**Fields**:
- Name (required)
- Description (textarea)
- City (dropdown, required)
- Cover Image URL
- Price From + Currency
- Age Label
- Sessions (0..N DateTime)

**Session Management**:
- Add session with date + time picker
- Sessions displayed in chronological order
- Remove individual sessions
- Sessions formatted in Russian locale

**Features**:
- Client-side validation
- Loading states
- Error handling
- Cancel support
- Customizable submit label

**Props**:
```typescript
{
  initialData?: Partial<ActivityFormData>;
  cities: Array<{ id: string; name: string }>;
  onSubmit: (data: ActivityFormData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}
```

## Business Routes

### /business/activities (List)
**File**: `src/app/business/(protected)/activities/page.tsx`

**Features**:
- Lists all activities for business
- Shows name, description, age, price, session count
- "Create Activity" button
- "Edit" button for each activity
- Empty state with CTA

**Access**: BUSINESS_OWNER only, requires business

### /business/activities/new (Create)
**File**: `src/app/business/(protected)/activities/new/page.tsx`

**Features**:
- Client component (uses ActivityForm)
- Loads cities from API
- Submits to POST `/api/business/activities`
- Redirects to list on success
- Cancel returns to list

### /business/activities/[id]/edit (Edit)
**File**: `src/app/business/(protected)/activities/[id]/edit/page.tsx`

**Features**:
- Client component (uses ActivityForm)
- Loads activity data from API
- Pre-fills form with existing data
- Submits to PATCH `/api/business/activities/[id]`
- Redirects to list on success
- Returns to list if activity not found

## API Routes

### GET /api/business/activities
**Purpose**: List business activities

**Auth**: BUSINESS_OWNER only

**Response**:
```json
{
  "activities": [...]
}
```

### POST /api/business/activities
**Purpose**: Create new activity

**Auth**: BUSINESS_OWNER only

**Request**:
```json
{
  "name": "string",
  "description": "string",
  "cityId": "string",
  "coverImageUrl": "string",
  "priceFrom": number,
  "currency": "string",
  "ageLabel": "string",
  "sessions": ["ISO string"]
}
```

**Response**:
```json
{
  "success": true,
  "activity": {...}
}
```

### GET /api/business/activities/[id]
**Purpose**: Get activity details

**Auth**: Must be able to manage activity

**Response**:
```json
{
  "activity": {...}
}
```

### PATCH /api/business/activities/[id]
**Purpose**: Update activity

**Auth**: Must be able to manage activity

**Request**: Same as POST (all fields optional)

### DELETE /api/business/activities/[id]
**Purpose**: Delete activity

**Auth**: Must be able to manage activity

## Architecture Benefits

### Reusability
✅ ActivityForm can be reused by EDITOR role
✅ Service layer separates business logic
✅ API routes handle authorization consistently
✅ No duplicate admin pages

### Separation of Concerns
✅ Business routes under `/business/activities`
✅ Admin routes separate (future: `/admin/activities`)
✅ Service layer shared between both
✅ Form component agnostic to user role

### Security
✅ Business owners can only manage own activities
✅ Authorization checked in every API route
✅ `canManageActivity` helper prevents unauthorized access
✅ Business verification status not checked (activities independent)

## Public Feed Integration

### How Activities Appear in Feed
Activities created by businesses will appear in public feed (`/minsk`) because:
1. They're stored in the same `Activity` table
2. Feed queries filter by `cityId`
3. No special filtering needed for business vs admin activities

### Future Enhancements
- Add moderation workflow (DRAFT → PENDING → PUBLISHED)
- Filter by business verification status
- Add activity approval process
- Implement activity visibility controls

## Files Created
- `prisma/migrations/20260303135017_add_business_activity_fields/migration.sql`
- `src/server/services/activity.service.ts`
- `src/features/activity/forms/ActivityForm.tsx`
- `src/app/business/(protected)/activities/page.tsx`
- `src/app/business/(protected)/activities/new/page.tsx`
- `src/app/business/(protected)/activities/[id]/edit/page.tsx`
- `src/app/api/business/activities/route.ts`
- `src/app/api/business/activities/[id]/route.ts`

## Files Modified
- `prisma/schema.prisma` (added fields to Activity, created ActivitySession)

## Verification
✅ TypeScript diagnostics pass (0 errors)
✅ Build succeeds with no warnings
✅ Migration applied successfully
✅ All routes registered
✅ Form validation working
✅ Authorization checks in place

## Not Implemented (Future)

### EDITOR Role Support
- Create `/admin/activities` routes
- Reuse same ActivityForm component
- Add EDITOR role check in API routes
- Allow editing any activity (not just own)

### Activity Moderation
- Add status field (DRAFT, PENDING, PUBLISHED, REJECTED)
- Implement approval workflow
- Add moderator comments
- Email notifications

### Advanced Features
- Image upload (currently URL only)
- Multiple images/gallery
- Rich text editor for description
- Tags/categories
- Location picker (map integration)
- Recurring sessions
- Capacity limits
- Booking integration

### Public Feed Filtering
- Filter by business verification status
- Hide unverified business activities
- Boost verified businesses
- Quality scoring

## Usage Example

### Creating an Activity
1. Business owner logs in
2. Goes to `/business/activities`
3. Clicks "Create Activity"
4. Fills form:
   - Name: "Детский мастер-класс по рисованию"
   - Description: "Увлекательное занятие для детей"
   - City: Минск
   - Price: 25 BYN
   - Age: "6+"
   - Sessions: Add 3 dates
5. Clicks "Create"
6. Activity appears in list
7. Activity visible in public feed `/minsk`

### Editing an Activity
1. From activities list, click "Edit"
2. Form pre-filled with existing data
3. Modify fields (e.g., add more sessions)
4. Click "Save"
5. Changes reflected immediately

## Next Steps
1. Add activity images to public feed cards
2. Implement EDITOR role support
3. Add moderation workflow
4. Create activity detail page improvements
5. Add analytics (views, saves, bookings)
6. Implement activity search/filtering
