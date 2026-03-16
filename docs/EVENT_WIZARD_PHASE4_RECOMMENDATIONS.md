# Event Wizard Phase 4 - Stabilization & UX Polish Recommendations

## Overview
Phase 4 focuses on production readiness through UX improvements, error handling, and reliability enhancements.

## Status: PARTIALLY IMPLEMENTED

### ✅ Completed in Previous Phases
- All 9 steps implemented
- Full validation system
- Create/Edit/Submit flow
- Data migration for localStorage
- Hydration error fixes

### 🔄 Phase 4 Improvements

## 1. Autosave Improvements ✅ DONE

### Implemented
- **Debounced autosave**: 2 second delay instead of 1 second
- **Error state tracking**: `saveError` state added
- **Error notifications**: Toast on autosave failure
- **Success feedback**: Clear error state on successful save

### Code Changes
```typescript
// Added error state
const [saveError, setSaveError] = useState<string | null>(null);

// Debounced autosave with error handling
useEffect(() => {
  const timer = setTimeout(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formData));
      setLastSaved(new Date());
      setSaveError(null);
    } catch (e) {
      setSaveError("Ошибка автосохранения");
    }
  }, 2000); // 2 second debounce
  return () => clearTimeout(timer);
}, [formData, mode]);
```

## 2. Media Integration 🔄 TODO

### Current State
- Manual ID input for coverImage
- Manual ID input for gallery
- No image preview
- No upload UI

### Recommended Implementation
**Option A: Use existing ImageUploader**
```typescript
import { ImageUploader } from "@/components/image/ImageUploader";

// In Step3Media.tsx
<ImageUploader
  value={data.coverImage}
  onChange={(imageId) => onChange({ coverImage: imageId })}
  wizardSessionId={wizardSessionId}
  label="Главное изображение"
/>
```

**Option B: Integrate with Media Library**
- Use existing media library modal
- Allow selection from uploaded images
- Show thumbnails

### Files to Modify
- `src/components/business/wizard/event/steps/Step3Media.tsx`
- Consider reusing patterns from Place Wizard Step3Photos

### Effort: Medium (4-6 hours)

## 3. Place Search Integration 🔄 TODO

### Current State
- Manual placeId input
- No search functionality
- No place preview

### Recommended Implementation
```typescript
// Create PlaceSearchInput component
interface PlaceSearchInputProps {
  value: string | null;
  onChange: (placeId: string, placeName: string) => void;
}

// Use in Step6Location.tsx
<PlaceSearchInput
  value={data.placeId}
  onChange={(id, name) => {
    onChange({ placeId: id });
    // Optionally store place name for display
  }}
/>
```

### API Endpoint Needed
```typescript
// GET /api/business/places/search?q=query
// Returns: { places: Array<{id, title, address}> }
```

### Files to Modify
- `src/components/business/wizard/event/steps/Step6Location.tsx`
- Create `src/components/business/place/PlaceSearchInput.tsx`
- Add search API endpoint

### Effort: Medium (4-6 hours)

## 4. Review Step UX Polish 🔄 PARTIAL

### Current State ✅
- Full validation display
- Step-by-step summary
- Jump to step navigation
- Missing fields highlighted

### Recommended Improvements
1. **Edit buttons per section**
```typescript
<button onClick={() => onGoToStep(1)}>
  Редактировать
</button>
```

2. **Collapsible sections** for better mobile UX

3. **Visual status indicators**
```typescript
{validation.isComplete ? (
  <CheckCircle className="text-green-600" />
) : (
  <AlertCircle className="text-yellow-600" />
)}
```

### Files to Modify
- `src/components/business/wizard/event/steps/Step9Review.tsx`

### Effort: Low (2-3 hours)

## 5. Error States & Empty States 🔄 TODO

### Needed Empty States
1. **Step 3 - No images**
```typescript
{data.gallery.length === 0 && (
  <div className="empty-state">
    <ImageIcon />
    <p>Галерея пуста</p>
    <Button>Добавить изображения</Button>
  </div>
)}
```

2. **Step 7 - No contacts**
```typescript
{!data.phone && !data.website && data.socialLinks.length === 0 && (
  <div className="empty-state">
    <p>Контакты не добавлены</p>
  </div>
)}
```

### Error Handling Improvements
1. **API Error Display**
```typescript
{saveError && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription>{saveError}</AlertDescription>
  </Alert>
)}
```

2. **Retry Logic**
```typescript
<Button onClick={handleSaveDraft} disabled={isSaving}>
  {isSaving ? "Сохранение..." : "Повторить"}
</Button>
```

### Files to Modify
- All step components
- `src/components/business/wizard/event/EventWizard.tsx`

### Effort: Medium (3-4 hours)

## 6. Mobile UX Check 📱 TODO

### Areas to Test
1. **Step 4 (DateTime)**
   - Date picker on mobile
   - Time input accessibility
   - Add/remove date buttons

2. **Step 7 (Contacts)**
   - Social links list on small screens
   - Input field sizing

3. **Step 9 (Review)**
   - Scrollable summary
   - Sticky submit buttons

### Recommended CSS Improvements
```css
/* Mobile-first responsive design */
@media (max-width: 640px) {
  .wizard-content {
    padding: 1rem;
  }
  
  .step-navigation {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .review-summary {
    font-size: 0.875rem;
  }
}
```

### Files to Modify
- All step components
- `src/components/business/wizard/event/EventWizard.tsx`

### Effort: Medium (4-5 hours)

## 7. Seed Events for QA 🔄 TODO

### Recommended Seed Data
```typescript
// prisma/seed-events.ts
const seedEvents = [
  {
    title: "Мастер-класс по рисованию",
    activityType: "educational",
    categories: ["Мастер-класс"],
    ageGroups: ["7-12", "12-18"],
    shortDescription: "Научитесь рисовать акварелью",
    fullDescription: "Подробная программа мастер-класса...",
    dates: ["2024-04-15", "2024-04-22"],
    isFree: false,
    price: "30 BYN",
    // ... more fields
  },
  {
    title: "Киносеанс: Детский фильм",
    activityType: "calm",
    categories: ["Кино"],
    ageGroups: ["3-7", "7-12"],
    cinemaGenre: "Анимация",
    cinemaDuration: 90,
    // ... more fields
  },
  {
    title: "Выставка современного искусства",
    activityType: "educational",
    categories: ["Выставка"],
    ageGroups: ["12-18", "18+"],
    // ... more fields
  },
];
```

### Files to Create
- `prisma/seed-events.ts`
- Update `package.json` scripts

### Effort: Low (2-3 hours)

## 8. End-to-End QA Scenarios ✅ READY

### Test Scenarios

#### Scenario 1: Create from Scratch
1. Navigate to `/business/events/new`
2. Fill Step 1: title, type, categories, age
3. Fill Step 2: descriptions
4. Skip Step 3 (media) for now
5. Fill Step 4: add 2 dates
6. Fill Step 5: set price
7. Fill Step 6: manual location
8. Skip Step 7 (contacts)
9. Fill Step 8: organizer
10. Go to Step 9: review
11. Click "Сохранить черновик"
12. ✅ Verify draft created

#### Scenario 2: Save Draft
1. Start creating event
2. Fill only Step 1 and Step 2
3. Click "Сохранить черновик"
4. ✅ Verify draft saved
5. ✅ Verify redirect to edit mode

#### Scenario 3: Refresh Page
1. Create draft
2. Refresh browser
3. ✅ Verify data persists
4. ✅ Verify no data loss

#### Scenario 4: Edit Existing
1. Open existing draft
2. ✅ Verify all fields populated
3. Edit Step 1 title
4. Edit Step 4 dates
5. Save
6. ✅ Verify changes saved

#### Scenario 5: Submit with Missing Fields
1. Create event with only Step 1
2. Go to Step 9
3. Click "Отправить на модерацию"
4. ✅ Verify validation errors shown
5. ✅ Verify submit button disabled or shows errors

#### Scenario 6: Successful Submit
1. Fill all required fields
2. Go to Step 9
3. ✅ Verify validation passes (green banner)
4. Click "Отправить на модерацию"
5. ✅ Verify status changed to PENDING_REVIEW
6. ✅ Verify redirect to events list

### QA Checklist
- [ ] All scenarios pass
- [ ] No console errors
- [ ] No hydration mismatches
- [ ] Data persists correctly
- [ ] Validation works as expected
- [ ] API calls succeed
- [ ] Error messages are clear
- [ ] Mobile UX is acceptable

## 9. Performance Optimization 🔄 TODO

### Current Issues
- Form re-renders on every keystroke
- No memoization of step components
- Payload includes unchanged fields

### Recommended Optimizations

#### 1. Memoize Step Components
```typescript
const Step1BasicsMemo = memo(Step1Basics);
const Step2DescriptionMemo = memo(Step2Description);
// ... etc
```

#### 2. Optimize handleChange
```typescript
const handleChange = useCallback((updates: Partial<EventFormData>) => {
  setFormData(prev => {
    // Only update if actually changed
    const hasChanges = Object.keys(updates).some(
      key => prev[key as keyof EventFormData] !== updates[key as keyof EventFormData]
    );
    return hasChanges ? { ...prev, ...updates } : prev;
  });
}, []);
```

#### 3. Minimal PATCH Payload
```typescript
// Use extractChanges() in handleSaveDraft
const changes = extractChanges(formData, originalFormData);
if (Object.keys(changes).length === 0) {
  // No changes, skip API call
  return;
}
```

### Files to Modify
- `src/components/business/wizard/event/EventWizard.tsx`
- All step components

### Effort: Medium (3-4 hours)

## 10. Production Readiness Checklist

### ✅ Ready
- [x] All steps implemented
- [x] Validation system complete
- [x] Create/Edit/Submit flow works
- [x] Data persistence (localStorage + API)
- [x] Error handling basics
- [x] Hydration errors fixed
- [x] Debounced autosave

### 🔄 Needs Work
- [ ] Media upload integration
- [ ] Place search integration
- [ ] Mobile UX testing
- [ ] Performance optimization
- [ ] Comprehensive error states
- [ ] Empty states
- [ ] Seed data for QA
- [ ] E2E testing

### ⚠️ Known Limitations
1. **Media**: Manual ID input (not user-friendly)
2. **Place Search**: Manual ID input (not user-friendly)
3. **ActivitySession**: Not created from dates yet
4. **Recurring Events**: Not generated yet
5. **FilterOptions**: Not mapped from categories
6. **Gallery SortOrder**: No drag-and-drop

## Summary

### Phase 4 Status: 40% Complete

**Completed:**
- Debounced autosave (2s)
- Error state tracking
- Data migration
- Hydration fixes

**High Priority TODO:**
1. Media integration (ImageUploader)
2. Place search component
3. Mobile UX testing
4. E2E QA scenarios

**Medium Priority TODO:**
1. Empty states
2. Error handling improvements
3. Performance optimization
4. Seed data

**Low Priority (Phase 5):**
1. ActivitySession management
2. Recurring events engine
3. FilterOptions mapping
4. Gallery drag-and-drop

### Estimated Effort to Production
- **High Priority**: 12-16 hours
- **Medium Priority**: 8-12 hours
- **Total**: 20-28 hours

### Recommendation
Event Wizard is **functional but not production-ready** without media and place search integrations. These are critical UX blockers. Consider:

1. **Quick Win**: Integrate existing ImageUploader (4-6 hours)
2. **Quick Win**: Add basic place search (4-6 hours)
3. **Polish**: Mobile testing and fixes (4-5 hours)
4. **QA**: Run all E2E scenarios (2-3 hours)

After these improvements, Event Wizard will be production-ready for MVP launch.
