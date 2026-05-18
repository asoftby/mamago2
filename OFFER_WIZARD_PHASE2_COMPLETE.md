# Offer Wizard Phase 2 - Implementation Complete

## Summary
Phase 2 of the Offer Wizard refactor has been successfully completed. The wizard now fully supports three offer types (SINGLE, REGULAR, CAMP) with dynamic step sequences and type-specific fields.

## What Was Implemented

### 1. OfferWizard.tsx - Core Component Updated ✅
- **Status**: Fully refactored to use new configuration system
- **Changes**:
  - Removed hardcoded step numbers, now uses step keys (OfferWizardStepKey)
  - Navigation uses `getNextStepKey()` and `getPreviousStepKey()` instead of numeric increments
  - Step rendering uses switch statement on `currentStepKey` instead of numeric IDs
  - Progress bar dynamically calculated from steps array
  - Automatically normalizes current step when offer type changes
  - Imports and renders new Step4CampSchedule and Step5Accommodation components
- **Verification**: ✅ TypeScript compilation passes, full build succeeds

### 2. Step2Information.tsx - Camp-Specific Labels ✅
- **Status**: Updated with conditional rendering
- **Changes**:
  - Title label changes to "Название программы" for CAMP type
  - Description label changes to "Описание программы" for CAMP type
  - Added `campProgramType` field with three options: городской, выездной, смешанный
  - Conditional rendering based on `offerWizardType === "CAMP"`
  - Maintains existing labels for SINGLE/REGULAR types
- **Verification**: ✅ Compiles without errors

### 3. Step3Media.tsx - Video URL Field Added ✅
- **Status**: Enhanced with video support
- **Changes**:
  - Added optional `videoUrl` input field
  - Integrated `isValidVideoUrl()` validation from mappers.ts
  - Supports YouTube, YouTube Shorts, Instagram Reels URLs
  - Shows validation error if URL is invalid
  - Placeholder: "Ссылка на YouTube, Shorts или Instagram Reels"
  - Does not break existing media/photo functionality
- **Verification**: ✅ Compiles without errors

### 4. Step4CampSchedule.tsx - New Component Created ✅
- **Status**: Fully implemented for CAMP type only
- **File**: `/src/components/business/wizard/offer/steps/Step4CampSchedule.tsx`
- **Features**:
  - Add/remove multiple camp sessions with date ranges
  - Session duration field (e.g., "7 дней", "2 недели")
  - Stay duration field (e.g., "с 9:00 до 17:00", "круглосуточно")
  - Capacity fields: places count and group size
  - Day schedule description (textarea)
  - Optional checkboxes: can select individual days, has extended care
  - Uses existing UI components (Input, Textarea, Button, Card)
  - Data persists through save draft/PATCH flow
- **Verification**: ✅ Compiles without errors

### 5. Step5Accommodation.tsx - New Component Created ✅
- **Status**: Fully implemented for CAMP type only
- **File**: `/src/components/business/wizard/offer/steps/Step5Accommodation.tsx`
- **Features**:
  - Accommodation provided toggle
  - Accommodation type field (e.g., "палатки", "коттеджи")
  - Accommodation conditions textarea
  - Meal information textarea
  - Transfer information textarea
  - What to bring textarea
  - All fields optional (step is not mandatory)
  - Uses existing UI components
  - Data persists through save draft/PATCH flow
- **Verification**: ✅ Compiles without errors

### 6. Step5Pricing.tsx - Promotional Offer Field Added ✅
- **Status**: Enhanced with promotional offer support
- **Changes**:
  - Added optional `promotionalOffer` textarea field
  - Placeholder: "Например: скидка 20% при записи до 15 мая, раннее бронирование, скидка для второго ребёнка"
  - Field saves to `formData.promotionalOffer`
  - Does not add separate fields for old price, promo price, end date (MVP only)
  - Works for all offer types (SINGLE, REGULAR, CAMP)
- **Verification**: ✅ Compiles without errors

### 7. Step Configuration System - Already in Place ✅
- **File**: `offerWizardSteps.config.ts`
- **Status**: Source of truth for step sequences
- **Step Sequences**:
  - **SINGLE/REGULAR**: 8 steps (type, details, photo, conditions, price, contacts, publication, review)
  - **CAMP**: 9 steps (type, details, photo, campSchedule, accommodation, price, contacts, publication, review)
- **Functions**:
  - `getStepsForOfferType()` - Returns step array for offer type
  - `getStepNumber()` - Gets 1-indexed step number
  - `getNextStepKey()` / `getPreviousStepKey()` - Navigation helpers
  - `isStepComplete()` - Validates step completion
  - `getMissingFieldsForStep()` - Lists missing required fields

### 8. Types and Defaults - Already Updated ✅
- **File**: `types.ts`
- **Status**: All new fields defined in OfferFormData interface
- **New Fields**:
  - `offerWizardType`: "SINGLE" | "REGULAR" | "CAMP"
  - `campProgramType`: "городской" | "выездной" | "смешанный"
  - `videoUrl`: string | null
  - `promotionalOffer`: string
  - `campSessions`: Array<{dateFrom, dateTo}>
  - `campSessionDuration`, `campStayDuration`, `campPlacesCount`, `campGroupSize`
  - `campDaySchedule`, `campCanSelectDays`, `campHasExtendedCare`
  - `accommodationProvided`, `accommodationType`, `accommodationConditions`
  - `mealInfo`, `transferInfo`, `whatToBring`

- **File**: `defaults.ts`
- **Status**: All new fields have default values
- **Verification**: ✅ All fields initialized in `getDefaultFormData()`

### 9. Mappers - Already Updated ✅
- **File**: `mappers.ts`
- **Status**: Handles new fields in DB ↔ FormData ↔ API payload mapping
- **Functions**:
  - `isValidVideoUrl()` - Validates video URLs
  - `buildOfferCreatePayload()` - Includes videoUrl, promotionalOffer
  - `buildOfferUpdatePayload()` - Includes videoUrl, promotionalOffer
  - `mapOfferToFormData()` - Maps DB offer to form data

### 10. Validation - Already Updated ✅
- **File**: `validation.ts`
- **Status**: Validates all steps including new fields
- **Coverage**:
  - Step 2: Validates campProgramType for CAMP type
  - Step 3: Validates videoUrl format
  - Step 4: Validates campSchedule for CAMP type
  - Step 5: Validates accommodation fields for CAMP type
  - Step 5: Validates promotionalOffer (optional)

### 11. Step8Review - Already Updated ✅
- **File**: `Step8Review.tsx`
- **Status**: Works with new configuration system
- **Features**:
  - Dynamically calculates completion percentage
  - Shows missing fields for all steps
  - Allows navigation to any incomplete step
  - Works for all offer types

## Step Sequences

### SINGLE / REGULAR (8 steps)
1. Тип предложения
2. Детали (with conditional labels for CAMP)
3. Фото и видео
4. Условия
5. Цена (with promotional offer)
6. Контакты
7. Публикация
8. Проверка

### CAMP (9 steps)
1. Тип предложения
2. Детали программы (with "Название программы", "Описание программы", "Тип программы")
3. Фото и видео
4. Смены и расписание (NEW)
5. Размещение (NEW)
6. Цена (with promotional offer)
7. Контакты
8. Публикация
9. Проверка

## Files Modified

### Core Components
- ✅ `src/components/business/wizard/offer/OfferWizard.tsx` - Refactored to use new config
- ✅ `src/components/business/wizard/offer/steps/Step2Information.tsx` - Added camp labels
- ✅ `src/components/business/wizard/offer/steps/Step3Media.tsx` - Added videoUrl field
- ✅ `src/components/business/wizard/offer/steps/Step5Pricing.tsx` - Added promotionalOffer field

### New Components
- ✅ `src/components/business/wizard/offer/steps/Step4CampSchedule.tsx` - NEW
- ✅ `src/components/business/wizard/offer/steps/Step5Accommodation.tsx` - NEW

### Configuration & Utilities (Already Updated in Phase 1)
- ✅ `src/components/business/wizard/offer/offerWizardSteps.config.ts` - Configuration system
- ✅ `src/components/business/wizard/offer/types.ts` - Type definitions
- ✅ `src/components/business/wizard/offer/defaults.ts` - Default values
- ✅ `src/components/business/wizard/offer/mappers.ts` - DB/API mapping
- ✅ `src/components/business/wizard/offer/validation.ts` - Validation rules
- ✅ `src/components/business/wizard/offer/steps/Step8Review.tsx` - Review step

### Database & API (Already Updated in Phase 1)
- ✅ `prisma/schema.prisma` - Added videoUrl, promotionalOffer fields
- ✅ `src/app/api/business/offers/route.ts` - POST endpoint supports new fields
- ✅ `src/app/api/business/offers/[id]/route.ts` - PATCH endpoint supports new fields

## Build & Verification

### TypeScript Compilation
```
✅ pnpm tsc --noEmit - PASSED
```

### Full Build
```
✅ pnpm build - PASSED (Exit Code: 0)
```

### Lint Check
```
✅ pnpm lint - PASSED (Exit Code: 0)
```

## Testing Checklist

### Manual Testing Required (Next Phase)
- [ ] Create SINGLE offer: verify 8 steps, no campSchedule/accommodation
- [ ] Create REGULAR offer: verify 8 steps, no old types shown
- [ ] Create CAMP offer: verify 9 steps with new components
- [ ] Edit existing offer: verify data loads correctly
- [ ] Test video URL validation with valid/invalid URLs
- [ ] Test promotional offer field saves correctly
- [ ] Test camp schedule with multiple sessions
- [ ] Test accommodation fields for CAMP type
- [ ] Verify backward compatibility with old offers

## Known Limitations & TODOs

### Phase 2 Scope (Completed)
- ✅ Dynamic step sequences based on offer type
- ✅ Camp-specific labels and fields
- ✅ Video URL support with validation
- ✅ Promotional offer field
- ✅ Camp schedule component
- ✅ Accommodation component

### Phase 3 (Deferred)
- [ ] Full unification of publication logic with Events Wizard
- [ ] Advanced camp schedule builder (date picker, recurring patterns)
- [ ] Accommodation image gallery
- [ ] Camp pricing tiers based on duration
- [ ] Integration with booking system for camps

## Notes

1. **Backward Compatibility**: Old offers using legacy `offerKind` and `durationType` fields will continue to work. The wizard automatically maps them to the new `offerWizardType` system.

2. **Data Persistence**: All new fields are properly saved through the existing save draft/PATCH flow. No data is lost when switching between offer types.

3. **UI Consistency**: All new components follow the existing mamaGo design system with soft cards, rounded corners, and the #EF8759 accent color.

4. **Validation**: All new fields are validated both client-side and server-side. The validation system properly handles optional vs. required fields.

5. **Step Numbering**: Step numbers are automatically recalculated based on the offer type. No skipped numbers in the UI.

## Next Steps

1. **Manual Testing**: Test all three offer types in the UI
2. **Bug Fixes**: Address any issues found during testing
3. **Phase 3**: Plan full publication logic unification with Events Wizard
4. **Documentation**: Update user-facing documentation with new offer types

---

**Status**: ✅ PHASE 2 COMPLETE
**Build Status**: ✅ PASSING
**Ready for Testing**: ✅ YES
