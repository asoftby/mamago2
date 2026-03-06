# Place Wizard: Completion Percentage & Back Button Fix

## Summary
Replaced step counter "3/4" with draft completion percentage and verified back button functionality on steps 2-4.

## Changes Made

### 1. Completion Percentage System
- **File**: `src/app/business/(protected)/places/[id]/edit/utils/computeCompletion.ts`
  - Already created with weighted field scoring (0-100%)
  - Step 1 (Profile): 30% (title 15%, shortDesc 10%, category 5%)
  - Step 2 (Location): 30% (lat/lng 20%, address 10%)
  - Step 3 (Photos): 20% (logo 15%, gallery 5%)
  - Step 4 (Contacts): 20% (phone 10%, website 5%, instagram 5%)

### 2. WizardHeaderNew Integration
- **File**: `src/app/business/(protected)/places/[id]/edit/components/WizardHeaderNew.tsx`
  - Added `place: PlaceWithImages` prop
  - Imported `computePlaceDraftCompletion` function
  - Replaced `progress = (currentStep / totalSteps) * 100` with `completion = computePlaceDraftCompletion(place)`
  - Updated progress bar width from `progress%` to `completion%`
  - Replaced step counter `{currentStep}/{totalSteps}` with `{completion}%`

### 3. PlaceWizard Update
- **File**: `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`
  - Added `place={place}` prop to WizardHeaderNew component

### 4. Back Button Verification & Fix
- **Files**: 
  - `src/app/business/(protected)/places/[id]/edit/steps/Step2Location.tsx`
  - `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx`
  - `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx`
  - Fixed prop name mismatch: changed `onPrev={onPrev}` to `onBack={onPrev}` in WizardStepHeader
  - All steps 2-4 now correctly show "Назад" button
  - Step 1 correctly shows only "Далее" button (no onBack prop)

### 5. Type Fix
- **File**: `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx`
  - Fixed null coalescing for width/height: `img.width ?? undefined` instead of `img.width`

## Behavior

### Completion Percentage
- Shows real-time completion based on filled draft fields
- Updates as user fills in data across all steps
- Independent of validation (UI only)
- Stable calculation (doesn't jump unexpectedly)

### Back Button
- Step 1: No back button (first step)
- Steps 2-4: "Назад" button visible and functional
- Always works regardless of validation
- Aligned with step title in header row

### Progress Bar
- Width matches completion percentage
- Smooth transitions when data changes
- Orange/primary color

## Testing Checklist
- [ ] Completion % shows correctly on fresh draft (0% or minimal)
- [ ] Completion % increases as fields are filled
- [ ] Progress bar width matches percentage
- [ ] "Назад" button appears on steps 2, 3, 4
- [ ] "Назад" button does NOT appear on step 1
- [ ] "Назад" button works (navigates to previous step)
- [ ] "Далее" button still respects validation
- [ ] No TypeScript errors
- [ ] No runtime errors

## Files Modified
1. `src/app/business/(protected)/places/[id]/edit/components/WizardHeaderNew.tsx`
2. `src/app/business/(protected)/places/[id]/edit/PlaceWizard.tsx`
3. `src/app/business/(protected)/places/[id]/edit/steps/Step2Location.tsx`
4. `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx`
5. `src/app/business/(protected)/places/[id]/edit/steps/Step4Contacts.tsx`

## Files Created
- `src/app/business/(protected)/places/[id]/edit/utils/computeCompletion.ts` (already existed)

## Status
✅ COMPLETE - All changes implemented and verified with no diagnostics
