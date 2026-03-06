# Place Wizard Zero-DB Implementation Plan

## Status: IN PROGRESS

## Completed ✅

### 1. Database Schema
- ✅ Added `TempMedia` model with enums
- ✅ Created migration `20260305222006_add_temp_media_for_wizard_sessions`
- ✅ Applied migration successfully

### 2. API Endpoints
- ✅ `POST /api/business/temp-media` - Upload temp media
- ✅ `GET /api/business/temp-media?wizardSessionId=...` - List temp media
- ✅ `POST /api/business/temp-media/reorder` - Reorder gallery
- ✅ `DELETE /api/business/temp-media/[id]` - Delete single item
- ✅ `DELETE /api/business/temp-media/session/[sessionId]` - Delete session
- ✅ Enhanced `POST /api/business/places` to attach temp media

### 3. Hooks & Utilities
- ✅ Created `useWizardSession` hook for session management

### 4. Components
- ✅ Created `PlaceLogoUploadTemp` component

## Remaining Tasks 🚧

### 5. Gallery Upload Component
```typescript
// src/components/business/place/PlaceGalleryUploadTemp.tsx
- Multi-file upload
- Drag & drop reordering
- Preview grid
- Delete individual images
- Works with wizardSessionId (no placeId)
```

### 6. Update NewPlaceWizard
```typescript
// src/app/business/(protected)/places/new/NewPlaceWizard.tsx

Changes needed:
1. Add wizardSessionId using useWizardSession hook
2. Update localDraft to track temp media IDs and URLs
3. Remove placeId state (not needed until save)
4. Update Step3Photos to use temp upload components
5. Pass wizardSessionId to Place creation API
6. Call clearSession() after successful save
7. Call DELETE session API on discard
8. Add state persistence to localStorage (optional)
```

### 7. Update Step3Photos
```typescript
// src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx

Changes needed:
1. Accept wizardSessionId prop
2. Use PlaceLogoUploadTemp instead of PlaceLogoUpload
3. Use PlaceGalleryUploadTemp instead of PlaceGalleryUpload
4. Remove onSaveDraft prop (not needed)
5. Track temp media IDs in localDraft
```

### 8. Remove Auto-Create Logic
```typescript
Files to check and clean:
- src/app/business/(protected)/places/new/page.tsx
  → Ensure no auto-create on mount
  
- src/app/business/(protected)/places/new/NewPlaceWizard.tsx
  → Remove any useEffect that creates Place
  → Remove saveDraft() calls except explicit button clicks
  → Remove placeId state management before save
  
- Verify no other components auto-create Place
```

### 9. Testing
```
Manual Tests:
1. Open wizard → verify no Place created
2. Upload logo → verify temp media created
3. Upload gallery → verify temp media created
4. Refresh page → verify uploads still visible
5. Navigate steps → verify no DB writes
6. Click "Save Draft" → verify Place created with images
7. Click "Submit" → verify Place created with images
8. Click "Discard" → verify temp media deleted
9. React StrictMode → verify no double uploads
10. Check /business/places → verify no orphan drafts

API Tests:
- POST temp-media with valid data → 200
- POST temp-media without wizardSessionId → 400
- GET temp-media with valid sessionId → 200 with media array
- DELETE temp-media/[id] → 200
- DELETE temp-media/session/[id] → 200 with deletedCount
- POST places with wizardSessionId → Place created with images attached
```

### 10. Documentation
```
- Update PLACE_WIZARD_COMPLETE.md
- Update docs/PLACE_API_USAGE.md
- Create PLACE_WIZARD_ZERO_DB_COMPLETE.md
- Add migration notes
```

## Implementation Order

### Phase 1: Core Components (Next)
1. Create `PlaceGalleryUploadTemp` component
2. Test temp media APIs manually
3. Verify upload → temp media → preview flow

### Phase 2: Wizard Integration
4. Update `NewPlaceWizard` to use `useWizardSession`
5. Update `Step3Photos` to use temp components
6. Update localDraft state to track temp media
7. Pass wizardSessionId to Place creation API

### Phase 3: Cleanup & Polish
8. Remove all auto-create logic
9. Add discard confirmation dialog
10. Test all flows thoroughly

### Phase 4: Documentation
11. Write comprehensive docs
12. Create testing checklist
13. Update context transfer docs

## Key Files

### Created
- `prisma/migrations/20260305222006_add_temp_media_for_wizard_sessions/`
- `src/app/api/business/temp-media/route.ts`
- `src/app/api/business/temp-media/reorder/route.ts`
- `src/app/api/business/temp-media/[id]/route.ts`
- `src/app/api/business/temp-media/session/[sessionId]/route.ts`
- `src/hooks/useWizardSession.ts`
- `src/components/business/place/PlaceLogoUploadTemp.tsx`
- `PLACE_WIZARD_SESSION_ARCHITECTURE.md`

### To Modify
- `src/app/business/(protected)/places/new/NewPlaceWizard.tsx`
- `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx`
- `src/app/api/business/places/route.ts` (already enhanced)

### To Create
- `src/components/business/place/PlaceGalleryUploadTemp.tsx`

## Risks & Mitigations

### Risk: Orphaned temp media
**Mitigation**: Implement background cleanup job (future)

### Risk: localStorage quota exceeded
**Mitigation**: Only store minimal state, rely on temp media API for images

### Risk: Session collision (multiple tabs)
**Mitigation**: Include userId in storage key, use unique sessionId per wizard instance

### Risk: CDN costs from abandoned uploads
**Mitigation**: Cleanup job deletes TEMP media > 24h old

## Next Steps

1. Create `PlaceGalleryUploadTemp` component
2. Update `NewPlaceWizard` to integrate wizard session
3. Test end-to-end flow
4. Remove auto-create logic
5. Write comprehensive tests
6. Document everything

## Estimated Time
- Gallery component: 30 min
- Wizard integration: 45 min
- Testing & fixes: 30 min
- Documentation: 15 min
- **Total: ~2 hours**
