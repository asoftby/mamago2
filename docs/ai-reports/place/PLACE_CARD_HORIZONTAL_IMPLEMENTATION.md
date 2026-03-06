# Place Card Horizontal Implementation - Complete

## Overview
Created a horizontal place card component for the business cabinet places list page with full CRUD functionality.

## Components Created

### 1. PlaceCardHorizontal Component
**File:** `src/components/business/places/PlaceCardHorizontal.tsx`

**Features:**
- Horizontal layout with 3 sections: cover image, content, actions
- 96x96 square cover image (logo or first gallery image)
- Placeholder icon when no image
- Title with fallback "Без названия"
- Address display (formattedAddr || customAddress || "Локация не задана")
- Geo chips:
  - District (manual override or auto-detected)
  - Metro (with distance, only shown if within threshold)
- Status badge with color coding:
  - DRAFT → "Черновик" (secondary/gray)
  - PENDING → "На модерации" (default/blue)
  - PUBLISHED → "Опубликовано" (default/blue)
  - NEEDS_CHANGES → "Требует правок" (destructive/red)
  - REJECTED → "Отклонено" (destructive/red)
- Primary action button:
  - DRAFT → "Продолжить"
  - PENDING → "На модерации" (disabled)
  - PUBLISHED → "Редактировать"
  - NEEDS_CHANGES/REJECTED → "Исправить"
- Delete button (trash icon, only for DRAFT status)
- Delete confirmation dialog
- Hover effects and transitions

**Metro Display Logic:**
```typescript
const shouldShowMetro = 
  metroName && 
  metroDistance !== null && 
  cityHasMetro && 
  metroDistance <= metroMaxDistance;
```

**Distance Formatting:**
- < 1000m → "850 м"
- >= 1000m → "1.4 км"

### 2. PlacesList Component
**File:** `src/app/business/(protected)/places/PlacesList.tsx`

**Features:**
- Client component for interactivity
- Empty state with "Добавить место" button
- "Добавить место" button at top when places exist
- List of PlaceCardHorizontal components
- Handles delete action with optimistic UI update
- Refreshes server data after delete

### 3. Places Page
**File:** `src/app/business/(protected)/places/page.tsx`

**Features:**
- Server component for data fetching
- Auth check (redirects if not BUSINESS_OWNER)
- Fetches places with all required relations:
  - city (hasMetro, metroMaxDistanceM)
  - districtAuto, districtManual
  - metroAuto, metroManual
  - images (sorted by sortOrder)
- Sorted by updatedAt desc
- Clean layout with header and description

### 4. Delete API Route
**File:** `src/app/api/business/places/[id]/delete/route.ts`

**Features:**
- DELETE method
- Auth check (BUSINESS_OWNER only)
- Ownership verification
- Status check (only DRAFT can be deleted)
- Hard delete (can be changed to soft delete later)
- Proper error handling with JSON responses

### 5. AlertDialog Component
**File:** `src/components/ui/alert-dialog.tsx`

**Features:**
- shadcn/ui wrapper for Radix UI AlertDialog
- Consistent styling with other UI components
- Animations and transitions
- Responsive layout

## Data Structure

### Place Query
```typescript
{
  id: string;
  title: string;
  status: ContentStatus;
  formattedAddr: string | null;
  customAddress: string | null;
  city: {
    hasMetro: boolean;
    metroMaxDistanceM: number | null;
  } | null;
  districtAuto: { name: string } | null;
  districtManual: { name: string } | null;
  metroAuto: { name: string } | null;
  metroAutoDistanceM: number | null;
  metroManual: { name: string } | null;
  metroManualDistanceM: number | null;
  images: Array<{
    id: string;
    url: string;
    kind: string;
  }>;
}
```

## User Flows

### 1. View Places List
1. Navigate to `/business/places`
2. See list of all places sorted by last updated
3. Each card shows:
   - Cover image or placeholder
   - Title and address
   - District and metro (if available)
   - Status badge
   - Action button

### 2. Edit Place
1. Click on card or "Продолжить"/"Редактировать" button
2. Navigate to `/business/places/[id]/edit`
3. Continue editing in wizard

### 3. Delete Draft Place
1. Click trash icon on DRAFT place
2. Confirm deletion in dialog
3. Place is deleted and removed from list
4. Toast notification shows success

### 4. Create New Place
1. Click "Добавить место" button
2. Navigate to `/business/places/new`
3. Start place creation wizard

### 5. Empty State
1. No places exist
2. See empty state with icon and message
3. Click "Добавить место" to create first place

## Styling

### Card Layout
- Flexbox horizontal layout
- 4px gap between sections
- 16px padding
- Border with hover effect
- Rounded corners (8px)
- Shadow on hover

### Cover Image
- 96x96 pixels (w-24 h-24)
- Rounded (8px)
- Object-fit: cover
- Gray background for placeholder
- MapPin icon for empty state

### Geo Chips
- Small text (text-xs)
- Padding: 8px horizontal, 4px vertical
- Rounded corners
- District: gray background
- Metro: blue background
- Icons: MapPin and Navigation

### Status Badges
- shadcn Badge component
- Variants: secondary, default, destructive
- Consistent with design system

## Testing Checklist

### Visual Testing
- [ ] Navigate to `http://localhost:3002/business/places`
- [ ] Verify page header "Мои места"
- [ ] Check empty state if no places
- [ ] Verify "Добавить место" button works
- [ ] Check place cards display correctly
- [ ] Verify cover images load
- [ ] Check placeholder icon for places without images
- [ ] Verify geo chips show district and metro
- [ ] Check metro distance formatting
- [ ] Verify status badges have correct colors
- [ ] Check action buttons have correct labels

### Interaction Testing
- [ ] Click on place card → navigates to edit page
- [ ] Click "Продолжить" button → navigates to edit page
- [ ] Click trash icon on DRAFT place → shows dialog
- [ ] Confirm delete → place is removed
- [ ] Cancel delete → dialog closes, place remains
- [ ] Hover over card → border and shadow change
- [ ] Click "Добавить место" → navigates to new place page

### Status Testing
- [ ] DRAFT place shows "Продолжить" and trash icon
- [ ] PENDING place shows "На модерации" (disabled)
- [ ] PUBLISHED place shows "Редактировать"
- [ ] NEEDS_CHANGES place shows "Исправить"
- [ ] REJECTED place shows "Исправить"

### Metro Display Testing
- [ ] Place in Minsk with metro < 2.5km → shows metro
- [ ] Place in Minsk with metro > 2.5km → no metro
- [ ] Place in city without metro → no metro
- [ ] Metro distance < 1000m → shows "XXX м"
- [ ] Metro distance >= 1000m → shows "X.X км"

### Error Handling
- [ ] Try to delete non-DRAFT place → shows error
- [ ] Try to delete place owned by another user → 403 error
- [ ] Network error during delete → shows error toast

## Files Changed

### Created
1. `src/components/business/places/PlaceCardHorizontal.tsx` - Horizontal place card component
2. `src/app/business/(protected)/places/PlacesList.tsx` - Client component for places list
3. `src/app/api/business/places/[id]/delete/route.ts` - Delete API endpoint
4. `src/components/ui/alert-dialog.tsx` - AlertDialog UI component

### Modified
1. `src/app/business/(protected)/places/page.tsx` - Updated from stub to full implementation

### Dependencies Added
1. `@radix-ui/react-alert-dialog` - Alert dialog primitive

## API Endpoints

### GET /business/places (Server Component)
- Fetches places for current user
- Returns places with all relations
- Sorted by updatedAt desc

### DELETE /api/business/places/[id]/delete
- Deletes a DRAFT place
- Requires BUSINESS_OWNER role
- Verifies ownership
- Returns success or error JSON

## Next Steps

### Enhancements
1. Add filters (status, search)
2. Add sorting options
3. Add pagination for large lists
4. Add bulk actions
5. Add statistics (views, clicks)
6. Add boost indicators
7. Add notes/comments
8. Implement soft delete with deletedAt field
9. Add restore functionality for archived places
10. Add duplicate place functionality

### Related Features
1. Reuse PlaceCardHorizontal for events/offers lists
2. Add place analytics dashboard
3. Add place performance metrics
4. Add place moderation history view

## URLs

- Places list: `http://localhost:3002/business/places`
- Create place: `http://localhost:3002/business/places/new`
- Edit place: `http://localhost:3002/business/places/[id]/edit`

## Notes

- Component is reusable for other entity types (events, offers)
- Metro display respects city configuration (hasMetro, metroMaxDistanceM)
- Delete is hard delete for now (can be changed to soft delete)
- Only DRAFT places can be deleted
- Images are sorted by sortOrder, first image is used as cover
- LOGO images have priority over GALLERY images for cover
