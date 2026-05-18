# Media Usage Count Audit - mamaGo 2.0

## Problem Statement

Images that are actually used in events/places/offers show `usageCount = 0` in the admin media library. This is dangerous because such files can be mistakenly considered unused and deleted.

---

## Phase 1: Current Schema Audit

### Models with Media Relations

#### 1. MediaAsset Model
```prisma
model MediaAsset {
  id               String           @id @default(cuid())
  kind             MediaAssetKind
  status           MediaAssetStatus @default(ACTIVE)
  filename         String
  publicUrl        String?
  usages           MediaUsage[]     // ✅ Relation exists
  articleCovers    Article[]        @relation("ArticleCover")
  articleSeoImages Article[]        @relation("ArticleSeoImage")
  // ... other fields
}
```

#### 2. MediaUsage Model (Tracking Table)
```prisma
model MediaUsage {
  id         String          @id @default(cuid())
  mediaId    String
  entityType MediaEntityType
  entityId   String
  field      String
  createdAt  DateTime        @default(now())
  media      MediaAsset      @relation(fields: [mediaId], references: [id], onDelete: Cascade)
  
  @@index([mediaId])
  @@index([entityType, entityId])
  @@index([entityType, entityId, field])
}
```

#### 3. Activity (Event) Model
**Media Fields**:
- `coverImageUrl` (String?) - ❌ Stores URL, not mediaId
- `coverImageId` (String?) - ✅ Relation field exists but not used
- `images` (ActivityImage[]) - ❌ Separate table with URLs

**Problem**: Events store `coverImageUrl` instead of using `coverImageId` relation.

#### 4. Place Model
**Media Fields**:
- `logoImageId` (String?) - ✅ Relation field exists
- `images` (PlaceImage[]) - ❌ Separate table with URLs

**Problem**: Places have `logoImageId` but gallery images stored as URLs.

#### 5. Offer Model
**Media Fields**:
- `coverImage` (String?) - ❌ Stores URL, not mediaId
- `galleryImages` (Json?) - ❌ Stores URLs in JSON array

**Problem**: Offers store URLs instead of mediaIds.

#### 6. Article Model
**Media Fields**:
- `coverImageId` (String?) - ✅ Proper relation
- `seoImageId` (String?) - ✅ Proper relation
- `coverImage` (MediaAsset?) - ✅ Relation works
- `seoImageAsset` (MediaAsset?) - ✅ Relation works

**Status**: ✅ Articles properly use MediaAsset relations.

---

## Current Usage Count Display

### Admin Media Library
**File**: `src/app/admin/media/[id]/page.tsx`
```typescript
const usages = await getMediaUsagesWithDetails(id);
// ...
usageCount={usages.length}  // ❌ Shows 0 if MediaUsage records don't exist
```

**Problem**: Displays `usages.length` which is 0 if MediaUsage records were never created.

---

## Current MediaUsage Service

**File**: `src/server/services/media/media-usage.service.ts`

**Functions**:
- ✅ `registerMediaUsage()` - Creates MediaUsage record
- ✅ `removeMediaUsage()` - Deletes MediaUsage record
- ✅ `getMediaUsages()` - Gets usages for media
- ✅ `getMediaUsagesWithDetails()` - Gets usages with entity details
- ✅ `replaceMediaUsage()` - Swaps media usage
- ✅ `countMediaUsages()` - Counts usages

**Status**: Service exists and works correctly, but is not called during entity mutations.

---

## Why Images Show 0 Usage

### Root Causes

1. **URLs Instead of MediaIds**
   - Activity: `coverImageUrl` stores URL
   - Offer: `coverImage` stores URL
   - Gallery images: stored as URL arrays
   - No MediaUsage records created

2. **No Sync After Mutations**
   - Creating Activity: doesn't call `registerMediaUsage()`
   - Updating Activity: doesn't sync MediaUsage
   - Deleting Activity: doesn't call `removeMediaUsage()`
   - Same for Place and Offer

3. **Mixed Storage Patterns**
   - Article: uses proper MediaAsset relations ✅
   - Activity/Place/Offer: use URL strings ❌
   - Inconsistent across entities

4. **No Backfill**
   - Existing data has no MediaUsage records
   - Old images show 0 usage even if used

---

## Current Mutation Flows (No MediaUsage Sync)

### Activity/Event Creation
**Files**:
- `src/app/api/business/events/route.ts`
- `src/app/api/business/activities-v2/route.ts`

**Problem**: Creates activity with `coverImageUrl` but doesn't call `registerMediaUsage()`.

### Activity/Event Update
**Files**:
- `src/app/api/business/events/[id]/route.ts`
- `src/app/api/business/activities-v2/[id]/route.ts`

**Problem**: Updates `coverImageUrl` but doesn't sync MediaUsage.

### Place Creation/Update
**Files**:
- `src/app/api/business/places/route.ts`
- `src/app/api/business/places/[id]/route.ts`

**Problem**: Uses `logoImageId` but doesn't sync MediaUsage.

### Offer Creation/Update
**Files**:
- `src/app/api/business/offers/route.ts`
- `src/app/api/business/offers/[id]/route.ts`

**Problem**: Uses `coverImage` URL but doesn't sync MediaUsage.

---

## Solution Architecture

### Phase 2: Enhanced MediaUsage Service

Create comprehensive service with functions:
- `syncActivityMediaUsage(activityId)` - Sync all media for activity
- `syncPlaceMediaUsage(placeId)` - Sync all media for place
- `syncOfferMediaUsage(offerId)` - Sync all media for offer
- `syncArticleMediaUsage(articleId)` - Sync all media for article
- `recomputeMediaUsageCounts(mediaIds?)` - Recompute for specific media
- `recomputeAllMediaUsageCounts()` - Full recompute (admin only)

### Phase 3: Integration Points

**Activity/Event**:
- POST `/api/business/events` - after create
- PATCH `/api/business/events/[id]` - after update
- POST `/api/business/events/[id]/submit` - after submit
- POST `/api/business/activities-v2/[id]/images` - after image add
- DELETE `/api/business/activities-v2/[id]/images/[imageId]` - after image delete

**Place**:
- POST `/api/business/places` - after create
- PATCH `/api/business/places/[id]` - after update
- Logo/gallery updates - after changes

**Offer**:
- POST `/api/business/offers` - after create
- PATCH `/api/business/offers/[id]` - after update

### Phase 4: Admin Recompute Endpoint

**Endpoint**: `POST /api/admin/media/recompute-usage`
- Admin-only
- Recomputes all MediaUsage records
- Returns stats (total, updated, zero usage, duration)
- Safe operation (no deletions)

### Phase 5: Admin UI Improvements

**Media Detail Page**:
- Show actual usage count from MediaUsage
- Add warning if URL-based usage detected
- Show detailed usage list with entity links
- Add "Recompute Usage" button

---

## Implementation Plan

### Step 1: Enhance MediaUsage Service ✅
- Add sync functions for each entity type
- Add recompute functions
- Handle URL-based media (extract mediaId from URL)

### Step 2: Create Admin Recompute Endpoint ✅
- POST `/api/admin/media/recompute-usage`
- Admin-only access
- Full recompute with stats

### Step 3: Integrate into Mutation Flows
- Activity create/update
- Place create/update
- Offer create/update
- Image add/remove

### Step 4: Update Admin UI
- Show correct usage count
- Add recompute button
- Show usage warnings

### Step 5: Testing
- Manual testing scenarios
- Verify usage counts
- Test recompute endpoint

---

## Expected Results

✅ Media library shows correct usage counts
✅ MediaUsage is single source of truth
✅ All create/update flows sync MediaUsage
✅ Old data can be fixed via admin recompute
✅ Cannot accidentally delete used files

---

## Files to Create/Modify

### New Files
- `src/lib/media/mediaUsageSync.service.ts` - Enhanced sync service
- `src/app/api/admin/media/recompute-usage/route.ts` - Admin endpoint

### Modified Files
- `src/server/services/media/media-usage.service.ts` - Add sync functions
- `src/app/api/business/events/route.ts` - Add sync after create
- `src/app/api/business/events/[id]/route.ts` - Add sync after update
- `src/app/api/business/places/route.ts` - Add sync after create
- `src/app/api/business/places/[id]/route.ts` - Add sync after update
- `src/app/api/business/offers/route.ts` - Add sync after create
- `src/app/api/business/offers/[id]/route.ts` - Add sync after update
- `src/components/admin/media/MediaActions.tsx` - Add recompute button

---

## Migration Strategy

1. **Deploy Enhanced Service** - No breaking changes
2. **Run Admin Recompute** - Backfill existing data
3. **Deploy Mutation Integrations** - New data syncs automatically
4. **Monitor Usage Counts** - Verify correctness

---

## Notes

- MediaUsage is denormalized cache, not source of truth
- Source of truth is actual relations/URLs in entities
- usageCount should be computed from MediaUsage records
- URL-based media needs special handling (extract mediaId)
- Recompute is safe operation (no deletions)

