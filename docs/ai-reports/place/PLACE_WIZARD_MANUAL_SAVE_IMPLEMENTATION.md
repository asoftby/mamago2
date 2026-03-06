# Place Wizard Manual Save - Implementation Guide

## Overview
This document provides step-by-step instructions to disable autosave in PlaceWizard and implement manual "Save draft" functionality.

## Current Status
✅ Draft creation already works correctly in `CreatePlaceRedirect.tsx`
- Creates Place with minimal data (title, category, shortDesc)
- Status = DRAFT (default)
- Redirects to edit page

## Implementation Steps

### STEP 1: Remove Autosave Hook from PlaceWizard
**File:** `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`

**Remove:**
```typescript
import { useAutosave } from "./hooks/useAutosave";

const { updatePlace, isUpdating } = useAutosave(place.id, {
  onSuccess: () => {
    setLastSaved(new Date());
  },
});
```

**Add dirty state tracking:**
```typescript
const [isDirty, setIsDirty] = useState(false);
const [pendingChanges, setPendingChanges] = useState<Partial<Place>>({});
```

**Replace handleUpdate:**
```typescript
// Old (autosave)
const handleUpdate = async (updates: Partial<Place>) => {
  setPlace((prev) => ({ ...prev, ...updates }));
  await updatePlace(updates);
};

// New (manual save)
const handleUpdate = (updates: Partial<Place>) => {
  // Optimistic UI update
  setPlace((prev) => ({ ...prev, ...updates }));
  
  // Track changes
  setPendingChanges((prev) => ({ ...prev, ...updates }));
  setIsDirty(true);
};
```

### STEP 2: Add Manual Save Function
**File:** `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`

```typescript
const [isSaving, setIsSaving] = useState(false);

const saveDraft = async () => {
  if (!isDirty || Object.keys(pendingChanges).length === 0) {
    return;
  }

  setIsSaving(true);
  try {
    const res = await fetch(`/api/business/places/${place.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingChanges),
    });

    if (!res.ok) {
      throw new Error("Failed to save");
    }

    // Success
    setIsDirty(false);
    setPendingChanges({});
    setLastSaved(new Date());
    toast.success("Черновик сохранён");
  } catch (error) {
    console.error("Save error:", error);
    toast.error("Ошибка сохранения");
    throw error;
  } finally {
    setIsSaving(false);
  }
};
```

### STEP 3: Add beforeunload Listener
**File:** `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`

```typescript
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = "You have unsaved changes";
      return "You have unsaved changes";
    }
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [isDirty]);
```

### STEP 4: Update Next Button to Save Before Navigate
**File:** `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`

```typescript
const handleNext = async () => {
  // Save if dirty
  if (isDirty) {
    try {
      await saveDraft();
    } catch (error) {
      // Don't navigate if save failed
      return;
    }
  }

  if (currentStep === 4) {
    handleSubmit();
  } else if (canGoToNextStep(currentStep, place)) {
    setCurrentStep(currentStep + 1);
  } else {
    toast.error("Заполните обязательные поля для продолжения");
  }
};
```

### STEP 5: Update WizardStepHeader to Show Save Button
**File:** `src/app/business/(protected)/places/[id]/edit/components/WizardStepHeader.tsx`

Add props:
```typescript
interface WizardStepHeaderProps {
  // ... existing props
  onSave?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
}
```

Add button:
```typescript
{isDirty && onSave && (
  <Button
    onClick={onSave}
    disabled={isSaving}
    variant="outline"
    size="sm"
  >
    {isSaving ? (
      <>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Сохранение...
      </>
    ) : (
      "Сохранить черновик"
    )}
  </Button>
)}
```

### STEP 6: Remove Autosave from PlaceLocationPicker
**File:** `src/components/business/place/PlaceLocationPicker.tsx`

**Current behavior:** Auto-saves on place select and map confirm

**New behavior:** Store location in state, return to parent

**Changes needed:**
1. Remove `saveLocation()` calls from `handlePlaceSelect` and `handleMapConfirm`
2. Add `onChange` prop to pass location data to parent
3. Parent (Step2Location) will handle saving

**New interface:**
```typescript
interface PlaceLocationPickerProps {
  placeId: string;
  initialLocation?: LocationData | null;
  onChange?: (location: LocationData) => void; // NEW
}
```

**Update handlers:**
```typescript
const handlePlaceSelect = (data: GooglePlaceData) => {
  const locationData = {
    lat: data.lat,
    lng: data.lng,
    googlePlaceId: data.googlePlaceId,
    formattedAddr: data.formattedAddr,
    addressJson: data.addressJson,
  };
  
  setLocation(locationData);
  onChange?.(locationData); // Pass to parent
  // DON'T call saveLocation()
};
```

### STEP 7: Update Step1Profile to Use Local State
**File:** `src/app/business/(protected)/places/[id]/edit/steps/Step1Profile.tsx`

**Current:** Calls `onUpdate()` on every change (triggers autosave)

**New:** Keep local state, only call `onUpdate()` when parent requests

**Add:**
```typescript
// Expose save function to parent
useImperativeHandle(ref, () => ({
  getData: () => ({
    title,
    category,
    shortDesc,
    description,
    ageTags,
    visitFormats,
    activityTypes,
  }),
}));
```

**Or simpler:** Keep calling `onUpdate()` but parent won't autosave

### STEP 8: Update Step2Location
**File:** `src/app/business/(protected)/places/[id]/edit/steps/Step2Location.tsx`

Pass location changes to parent without saving:
```typescript
<PlaceLocationPicker
  placeId={place.id}
  initialLocation={initialLocation}
  onChange={(locationData) => {
    onUpdate(locationData); // Parent tracks but doesn't save
  }}
/>
```

### STEP 9: Update Step3Photos
**File:** `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx`

- Image upload to storage can happen immediately
- But don't save image reference to Place until user clicks save
- Store uploaded image URLs in local state
- Pass to parent on save

### STEP 10: Update Step4Contacts
**File:** `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx`

Similar to Step1Profile:
- Keep local state
- Don't call `onUpdate()` on every change
- Or call it but parent won't autosave

### STEP 11: Update WizardHeaderNew
**File:** `src/app/business/(protected)/places/[id]/edit/components/WizardHeaderNew.tsx`

Update to show save button and dirty indicator:
```typescript
{isDirty && (
  <div className="flex items-center gap-2">
    <span className="text-xs text-yellow-600">Несохранённые изменения</span>
    <Button onClick={onSave} size="sm" variant="outline">
      Сохранить черновик
    </Button>
  </div>
)}
```

## Testing Checklist

### Draft Creation
- [ ] Click "Добавить место" from places list
- [ ] Draft created with minimal data
- [ ] Redirected to edit page step 1
- [ ] No extra empty drafts created

### Manual Save
- [ ] Edit title → no API call
- [ ] Click "Сохранить черновик" → API call, toast shown
- [ ] Changes persisted in database
- [ ] Dirty indicator cleared

### Navigation
- [ ] Edit field, click "Далее" → saves then navigates
- [ ] No changes, click "Далее" → navigates immediately
- [ ] Click step indicator with changes → saves then navigates

### Data Loss Prevention
- [ ] Edit field, try to close tab → warning shown
- [ ] No changes, close tab → no warning
- [ ] Edit field, navigate away → warning shown

### Location
- [ ] Select Google place → no immediate API call
- [ ] Location shown in preview
- [ ] Click "Сохранить черновик" → location saved
- [ ] Geo enrichment runs on save

### Images
- [ ] Upload image → image uploaded to storage
- [ ] No immediate save to Place
- [ ] Click "Сохранить черновик" → image reference saved

### Submit
- [ ] Fill all required fields
- [ ] Click "Отправить на модерацию"
- [ ] Works as before

### Error Handling
- [ ] Network error on save → error toast shown
- [ ] Can retry save
- [ ] Dirty state preserved

## Files to Modify

1. ✅ `PLACE_WIZARD_MANUAL_SAVE_PLAN.md` - Created
2. ✅ `PLACE_WIZARD_MANUAL_SAVE_IMPLEMENTATION.md` - Created
3. `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx` - Remove autosave, add manual save
4. `src/app/business/(protected)/places/[id]/edit/components/WizardStepHeader.tsx` - Add save button
5. `src/app/business/(protected)/places/[id]/edit/components/WizardHeaderNew.tsx` - Add dirty indicator
6. `src/components/business/place/PlaceLocationPicker.tsx` - Remove autosave
7. `src/app/business/(protected)/places/[id]/edit/steps/Step1Profile.tsx` - Local state
8. `src/app/business/(protected)/places/[id]/edit/steps/Step2Location.tsx` - Pass onChange
9. `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx` - Remove autosave
10. `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx` - Local state

## Estimated Effort

- Planning: ✅ Done
- Implementation: 4-6 hours
- Testing: 2-3 hours
- Bug fixes: 1-2 hours
- Total: 7-11 hours

## Risks & Mitigation

### Risk: Users forget to save
**Mitigation:**
- Auto-save on "Далее" button
- Warning on page leave
- Visual "unsaved changes" indicator
- Prominent "Сохранить черновик" button

### Risk: Complex state management
**Mitigation:**
- Clear separation: local state vs saved state
- Single source of truth for pending changes
- Dirty flag per wizard, not per field

### Risk: Location picker complexity
**Mitigation:**
- Keep location in memory
- Save all location data in one API call
- Geo enrichment still runs server-side

## Next Steps

1. Review this implementation plan
2. Confirm approach with team
3. Start implementation with Step 1
4. Test each step before moving to next
5. Full integration testing at end
6. Deploy to staging for QA

## Notes

- Draft creation already works correctly ✅
- Most APIs don't need changes ✅
- Main work is in PlaceWizard and child components
- PlaceLocationPicker needs significant refactoring
- Image upload flow needs clarification
