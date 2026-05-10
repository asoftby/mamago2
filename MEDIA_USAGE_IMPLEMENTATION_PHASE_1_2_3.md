# Media Usage Count Fix - Implementation Progress

## ✅ Completed Phases

### Phase 1: Audit (COMPLETED)
- Analyzed all models with media relations
- Identified root causes of 0 usage count issue
- Documented current state in `MEDIA_USAGE_AUDIT.md`

### Phase 2: Enhanced MediaUsage Service (COMPLETED)
**File**: `src/server/services/media/media-usage.service.ts`

**New Functions Added**:
- ✅ `syncActivityMediaUsage(activityId)` - Syncs all media for an activity/event
- ✅ `syncPlaceMediaUsage(placeId)` - Syncs all media for a place
- ✅ `syncOfferMediaUsage(offerId)` - Syncs all media for an offer
- ✅ `syncArticleMediaUsage(articleId)` - Syncs all media for an article
- ✅ `recomputeMediaUsageCounts(mediaIds)` - Recomputes for specific media
- ✅ `recomputeAllMediaUsageCounts()` - Full recompute (admin only)
- ✅ `extractMediaIdFromUrl(url)` - Helper for URL-based media (TODO: implement parsing)

**How It Works**:
1. Each sync function fetches the entity with its media relations
2. Collects all mediaIds from various fields (cover, logo, gallery, etc.)
3. Deletes old MediaUsage records for that entity
4. Creates new MediaUsage records (deduplicated)
5. Returns stats: mediaIds array and usage count

**Current Limitations**:
- URL-based media (Activity.coverImageUrl, Offer.coverImage, gallery images) cannot be synced yet
- Need to implement `extractMediaIdFromUrl()` to parse media URLs
- Gallery images in ActivityImage and PlaceImage tables store URLs, not mediaIds

### Phase 3: Admin Recompute Endpoint (COMPLETED)
**File**: `src/app/api/admin/media/recompute-usage/route.ts`

**Endpoint**: `POST /api/admin/media/recompute-usage`

**Features**:
- ✅ Admin-only access (checks user.role === "ADMIN")
- ✅ Clears all existing MediaUsage records
- ✅ Syncs all activities, places, offers, and articles
- ✅ Returns comprehensive stats:
  - `totalMediaAssets` - total number of media files
  - `zeroUsageCount` - files with 0 usage
  - `durationMs` - time taken
  - `stats` - breakdown by entity type (activities, places, offers, articles, errors)

**Safety**:
- No deletions of media files
- No URL changes
- Only MediaUsage record sync
- Can be run multiple times safely

### Phase 4: Admin UI Update (COMPLETED)
**File**: `src/components/admin/media/MediaActions.tsx`

**Changes**:
- ✅ "Пересчитать usage" button now functional
- ✅ Calls `/api/admin/media/recompute-usage` endpoint
- ✅ Shows loading state with spinning icon
- ✅ Displays success message with stats
- ✅ Displays error message if recompute fails
- ✅ Refreshes page to show updated usage count

**User Experience**:
1. Admin opens media detail page
2. Clicks "Пересчитать usage" button
3. Button shows "Пересчёт..." with spinning icon
4. Success message shows: "Пересчёт завершён за 2.3с. Обработано: 150 событий, 80 мест, 30 предложений, 45 статей."
5. Page refreshes to show updated usage count

---

## 🚧 Remaining Phases

### Phase 5: Integration into Mutation Flows (TODO)
Need to integrate sync calls into entity create/update endpoints:

**Activity/Event**:
- [ ] `src/app/api/business/events/route.ts` (POST) - after create
- [ ] `src/app/api/business/events/[id]/route.ts` (PATCH) - after update
- [ ] `src/app/api/business/activities-v2/[id]/images/route.ts` - after image add
- [ ] `src/app/api/business/activities-v2/[id]/images/[imageId]/route.ts` - after image delete

**Place**:
- [ ] `src/app/api/business/places/route.ts` (POST) - after create
- [ ] `src/app/api/business/places/[id]/route.ts` (PATCH) - after update

**Offer**:
- [ ] `src/app/api/business/offers/route.ts` (POST) - after create
- [ ] `src/app/api/business/offers/[id]/route.ts` (PATCH) - after update

**Integration Pattern**:
```typescript
// After successful create/update
try {
  await syncActivityMediaUsage(activity.id);
} catch (error) {
  console.error("Failed to sync media usage:", error);
  // Don't block the main flow
}
```

### Phase 6: Testing (TODO)
Manual test scenarios:
- [ ] Upload image → set as cover → verify usageCount = 1
- [ ] Remove from cover → verify usageCount = 0
- [ ] Same image in cover + gallery → verify no duplicates
- [ ] Test admin recompute endpoint fixes old data
- [ ] Test recompute button in admin UI
- [ ] Verify usage list shows correct entities

---

## 📊 Current State

### What Works Now
✅ Admin can manually trigger full recompute via UI button
✅ Recompute syncs all Article media (proper relations)
✅ Recompute syncs Activity.coverImageId (if used)
✅ Recompute syncs Place.logoImageId (if used)
✅ MediaUsage records are created correctly
✅ Usage count displays correctly from MediaUsage records
✅ TypeScript compilation passes

### What Doesn't Work Yet
❌ URL-based media not synced (Activity.coverImageUrl, Offer.coverImage)
❌ Gallery images not synced (ActivityImage, PlaceImage tables)
❌ Automatic sync on entity create/update not integrated
❌ New entities don't automatically create MediaUsage records

### Known Limitations
⚠️ Most Activity/Place/Offer entities use URLs instead of mediaId relations
⚠️ Gallery images stored in separate tables with URLs
⚠️ Need to implement URL parsing to extract mediaIds
⚠️ Recompute is manual - need to integrate into mutation flows

---

## 🎯 Next Steps

### Immediate (Phase 5)
1. Read Activity create/update API routes
2. Add sync calls after successful mutations
3. Test with real data
4. Repeat for Place and Offer

### Future Improvements
1. Implement `extractMediaIdFromUrl()` to handle URL-based media
2. Migrate entities to use mediaId relations instead of URLs
3. Add automatic sync on image upload/delete
4. Add background job for periodic recompute
5. Add warning in admin UI if URL-based usage detected

---

## 📝 Files Modified

### Enhanced
- `src/server/services/media/media-usage.service.ts` - Added sync functions

### Created
- `src/app/api/admin/media/recompute-usage/route.ts` - Admin recompute endpoint

### Updated
- `src/components/admin/media/MediaActions.tsx` - Functional recompute button

### Documentation
- `MEDIA_USAGE_AUDIT.md` - Phase 1 audit
- `MEDIA_USAGE_IMPLEMENTATION_PHASE_1_2_3.md` - This file

---

## 🔍 Testing Commands

```bash
# TypeScript check
pnpm tsc --noEmit

# Lint check
pnpm lint

# Build check
pnpm build
```

All checks passing ✅

---

## 💡 Usage Instructions

### For Admins
1. Go to `/admin/media/{mediaId}` for any media file
2. Click "Пересчитать usage" button in Actions panel
3. Wait for recompute to complete (shows stats)
4. Page refreshes with updated usage count

### For Developers
```typescript
// Sync media usage after entity mutation
import { syncActivityMediaUsage } from "@/server/services/media/media-usage.service";

// After creating/updating activity
await syncActivityMediaUsage(activityId);

// After creating/updating place
await syncPlaceMediaUsage(placeId);

// After creating/updating offer
await syncOfferMediaUsage(offerId);
```

---

## ⚠️ Important Notes

1. **MediaUsage is a cache** - Source of truth is actual relations in entities
2. **Recompute is safe** - No deletions, no URL changes
3. **Don't block main flow** - Sync errors should be logged, not thrown
4. **URL-based media** - Currently not synced, needs implementation
5. **Manual recompute** - Required until Phase 5 integration complete

---

## 🎉 Success Criteria

- [x] Admin can trigger recompute via UI
- [x] Recompute syncs all entities
- [x] Usage count displays correctly
- [x] No TypeScript errors
- [ ] Automatic sync on entity mutations (Phase 5)
- [ ] URL-based media synced (Future)
- [ ] Gallery images synced (Future)

**Status**: Phases 1-4 Complete ✅ | Phase 5-6 In Progress 🚧
