# Offer Wizard Refactor Progress

## Completed ✅

### 1. Database Schema Updates
- ✅ Added `videoUrl` field to Offer model (optional, for YouTube/Shorts/Instagram Reels)
- ✅ Added `promotionalOffer` field to Offer model (optional, for promotional text)
- ✅ Created and applied migration: `20260509161833_add_offer_video_and_promotional_offer`

### 2. Type System Updates
- ✅ Updated `OfferFormData` interface with:
  - New `offerWizardType: "SINGLE" | "REGULAR" | "CAMP" | null`
  - New `videoUrl: string | null`
  - New `promotionalOffer: string`
  - Camp-specific fields: `campProgramType`, `campSessionDuration`, `campStayDuration`, `campPlacesCount`, `campGroupSize`, `campDaySchedule`, `campCanSelectDays`, `campHasExtendedCare`
  - Accommodation fields: `accommodationProvided`, `accommodationType`, `accommodationConditions`, `mealInfo`, `transferInfo`, `whatToBring`
- ✅ Added new types: `OfferWizardType`, `OfferWizardStepKey`
- ✅ Updated defaults.ts with all new fields

### 3. Configuration System
- ✅ Created new `offerWizardSteps.config.ts` with:
  - `getStepsForOfferType(type)` - returns step sequence for offer type
  - `getStepNumber(type, stepKey)` - get step number (1-indexed)
  - `getTotalStepsForType(type)` - total steps for type
  - `getStepDefByKey(type, stepKey)` - get step definition
  - `shouldShowStep(type, stepKey)` - check if step should be shown
  - `getNextStepKey()`, `getPreviousStepKey()` - navigation
  - `isStepComplete()` - check step completion
  - `getMissingFieldsForStep()` - get missing fields

Step sequences defined:
- **SINGLE/REGULAR**: type → details → photo → conditions → price → contacts → publication → review (8 steps)
- **CAMP**: type → details → photo → campSchedule → accommodation → price → contacts → publication → review (9 steps)

### 4. API Updates
- ✅ Updated POST `/api/business/offers` schema with `videoUrl` and `promotionalOffer`
- ✅ Updated PATCH `/api/business/offers/[id]` schema with new fields
- ✅ Updated offer creation to save new fields
- ✅ Updated offer update to save new fields

### 5. Mappers
- ✅ Added `isValidVideoUrl()` function for URL validation
- ✅ Updated `buildOfferCreatePayload()` to include new fields
- ✅ Updated `buildOfferUpdatePayload()` to include new fields
- ✅ Updated `mapOfferToFormData()` to load new fields from DB

### 6. Step Components
- ✅ Updated Step1Type to show only 3 types (SINGLE, REGULAR, CAMP)
  - Removed old types (COURSE, PROGRAM, SUBSCRIPTION, MEMBERSHIP)
  - Maps to new `offerWizardType` field
  - Clean UI with icons and descriptions

- ✅ Updated Step8Review to work with new configuration system
  - Shows correct step numbers based on offer type
  - Displays completion progress
  - Lists missing fields
  - Allows navigation to specific steps

### 7. Build & Compilation
- ✅ All TypeScript types compile without errors
- ✅ Project builds successfully with `pnpm build`
- ✅ No new warnings or errors introduced

## In Progress 🔄

### Step Components (Remaining)
- Need to update Step2Information to show camp-specific labels
- Need to update Step3Media to include videoUrl field
- Need to update Step5Pricing to include promotionalOffer field
- Need to create Step4CampSchedule for CAMP type
- Need to create Step5Accommodation for CAMP type

### OfferWizard Component
- Need to update to use new step configuration system
- Need to handle dynamic step navigation based on offer type
- Need to update progress bar calculation

## TODO 📋

### 1. Step Components Refactor (Priority: HIGH)
- [ ] Update Step2Information to:
  - Show "Название программы" / "Описание программы" for CAMP type
  - Show "Название" / "Описание" for SINGLE/REGULAR types
  - Add `campProgramType` selector for CAMP (городской, выездной, смешанный)

- [ ] Update Step3Media to:
  - Add videoUrl field with validation
  - Show placeholder: "Ссылка на YouTube, Shorts или Instagram Reels"
  - Add URL validation with helpful error messages

- [ ] Update Step5Pricing to:
  - Add promotionalOffer field
  - Show placeholder: "Например: скидка 20% при записи до 15 мая, раннее бронирование, скидка для второго ребёнка"

- [ ] Create Step4CampSchedule for CAMP type:
  - Dates (dateFrom, dateTo)
  - Session duration
  - Stay duration
  - Places count
  - Group size
  - Day schedule description
  - Can select individual days (checkbox)
  - Has extended care (checkbox)

- [ ] Create Step5Accommodation for CAMP type:
  - Accommodation provided (toggle)
  - Accommodation type (text)
  - Living conditions (textarea)
  - Meal info (textarea)
  - Transfer info (textarea)
  - What to bring (textarea)

### 2. OfferWizard Component Updates (Priority: HIGH)
- [ ] Update OfferWizard.tsx to:
  - Use new step configuration system
  - Dynamically calculate total steps based on offer type
  - Handle step navigation with new config
  - Update progress bar to show correct step numbers
  - Map between step numbers and step keys

### 3. Validation Updates (Priority: MEDIUM)
- [ ] Update validation.ts to:
  - Validate videoUrl format
  - Validate promotionalOffer (optional)
  - Validate camp-specific fields for CAMP type
  - Validate accommodation fields (optional for CAMP)

### 4. Publication Logic (Priority: MEDIUM)
- [ ] Study Events Wizard publication step (Step9Publication)
- [ ] Extract common publication logic
- [ ] Create shared PublicationStep component or integrate into Offer wizard
- [ ] Implement status flow: DRAFT → PENDING → PUBLISHED
- [ ] Add moderation checks and warnings

### 5. Backward Compatibility (Priority: MEDIUM)
- [ ] Handle existing offers with old types (COURSE, PROGRAM, SUBSCRIPTION, MEMBERSHIP)
- [ ] Map old types to new types when loading:
  - COURSE → SINGLE or REGULAR (based on durationType)
  - PROGRAM → REGULAR
  - SUBSCRIPTION → REGULAR
  - MEMBERSHIP → REGULAR
- [ ] Ensure old offers can be edited without data loss

### 6. Testing (Priority: HIGH)
- [ ] Create new offer (SINGLE type)
- [ ] Create new offer (REGULAR type)
- [ ] Create new offer (CAMP type)
- [ ] Edit existing offer
- [ ] Verify all fields save correctly
- [ ] Verify step navigation works
- [ ] Verify validation works
- [ ] Test backward compatibility with old offers

### 7. Lint & Code Quality (Priority: MEDIUM)
- [ ] Run `pnpm lint`
- [ ] Fix any linting issues
- [ ] Verify no new warnings

## Architecture Notes

### Step Configuration System
The new configuration system allows dynamic step sequences based on offer type:

```typescript
// Get steps for a specific type
const steps = getStepsForOfferType("CAMP");
// Returns: [type, details, photo, campSchedule, accommodation, price, contacts, publication, review]

// Get step number (1-indexed)
const stepNum = getStepNumber("CAMP", "campSchedule");
// Returns: 4

// Check if step should be shown
const show = shouldShowStep("SINGLE", "accommodation");
// Returns: false
```

### New Fields Storage
- `videoUrl`: Stored directly in Offer model
- `promotionalOffer`: Stored directly in Offer model
- Camp-specific fields: Can be stored in Offer model or in a separate CampSession model (MVP uses Offer model)
- Accommodation fields: Can be stored in Offer model or in a separate Accommodation model (MVP uses Offer model)

### Backward Compatibility Strategy
- Old `offerKind` and `durationType` fields remain in form data
- New `offerWizardType` field is primary for new offers
- When loading old offers, map old types to new types
- When saving, keep both old and new fields for compatibility

## Files Modified

1. `/prisma/schema.prisma` - Added videoUrl and promotionalOffer fields
2. `/src/components/business/wizard/offer/types.ts` - Updated OfferFormData interface
3. `/src/components/business/wizard/offer/defaults.ts` - Added new field defaults
4. `/src/components/business/wizard/offer/offerWizardSteps.config.ts` - New configuration system (replaced old file)
5. `/src/components/business/wizard/offer/mappers.ts` - Updated payload builders
6. `/src/app/api/business/offers/route.ts` - Updated POST schema and handler
7. `/src/app/api/business/offers/[id]/route.ts` - Updated PATCH schema and handler
8. `/src/components/business/wizard/offer/steps/Step1Type.tsx` - Updated to show only 3 types
9. `/src/components/business/wizard/offer/steps/Step8Review.tsx` - Updated for new config system

## Files to Create

1. `/src/components/business/wizard/offer/steps/Step4CampSchedule.tsx` - New step for CAMP
2. `/src/components/business/wizard/offer/steps/Step5Accommodation.tsx` - New step for CAMP

## Files to Update

1. `/src/components/business/wizard/offer/OfferWizard.tsx` - Use new config system
2. `/src/components/business/wizard/offer/steps/Step2Information.tsx` - Add camp labels
3. `/src/components/business/wizard/offer/steps/Step3Media.tsx` - Add videoUrl field
4. `/src/components/business/wizard/offer/steps/Step5Pricing.tsx` - Add promotionalOffer field
5. `/src/components/business/wizard/offer/validation.ts` - Update validation rules

## Build Status

✅ **TypeScript Compilation**: All types compile without errors
✅ **Project Build**: `pnpm build` completes successfully
✅ **No New Warnings**: No new warnings or errors introduced

## Next Steps

1. Update Step2Information component to show camp-specific labels
2. Update Step3Media component to include videoUrl field
3. Update Step5Pricing component to include promotionalOffer field
4. Create Step4CampSchedule component for CAMP type
5. Create Step5Accommodation component for CAMP type
6. Update OfferWizard to use new configuration system
7. Update validation.ts for new fields
8. Test all offer types
9. Run lint checks
10. Test backward compatibility with old offers
