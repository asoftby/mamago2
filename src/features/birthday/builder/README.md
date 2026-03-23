# Birthday Builder — Foundation Layer

Clean rewrite of birthday constructor with proper base/addon separation and conflict logic.

## Created Files

### Types
- `builder/types/builder.ts` — Builder-specific types (BuilderStep, PlaceType, ConflictReason, BirthdayBuilderState)

### State Management
- `builder/hooks/useBirthdayBuilder.ts` — Main state hook with:
  - Quiz inputs (age, budget, guests, theme, placeType)
  - Selection (selectedBaseId, selectedAddonIds)
  - Validation (conflicts array)
  - UI state (currentStep)

### Business Logic
- `builder/lib/compatibility.ts` — Compatibility checking:
  - `checkAddonCompatibility()` — Check if addon works with current base
  - `revalidateAddons()` — Revalidate all addons after base change
  - `removeConflictedAddons()` — Remove conflicts from selection

## Modified Files

### Types
- `types/birthday.ts` — Extended with:
  - `layer: OfferLayer` — BASE | ENTERTAINMENT | FOOD | DECOR | EXTRA
  - `venueIncludes?: string[]` — What's included in venue/package
  - `compatibility?: OfferCompatibility` — Compatibility constraints

### Mock Data
- `data/mockBirthdayOffers.ts` — Updated 7 sample offers with:
  - `layer` field
  - `businessId` field
  - `venueIncludes` array
  - `compatibility` object

## State Model

```typescript
{
  quiz: {
    ageGroup, budgetGroup, guestsGroup, theme, placeType
  },
  selection: {
    selectedBaseId,        // Only one base (venue or package)
    selectedAddonIds[]     // Multiple addons
  },
  validation: {
    conflicts: [           // Incompatible addons
      { offerId, reason, message }
    ]
  },
  ui: {
    currentStep,           // intro | basics | place | entertainment | food | decor | summary | confirm
  }
}
```

## Base Replacement + Conflict Logic

### When user selects/replaces base:
1. New base is set as `selectedBaseId`
2. All `selectedAddonIds` are revalidated against new base
3. Compatible addons remain selected
4. Incompatible addons are marked as conflicts (NOT removed)
5. Conflicts array is updated with reasons

### Conflict reasons:
- `VENUE_MISMATCH` — Addon requires different venue
- `FORMAT_MISMATCH` — Addon incompatible with base format (HOME/VENUE/OUTDOOR)
- `EXCLUSIVE_TO_PREVIOUS_BASE` — Addon exclusive to previous venue
- `BUDGET_MISMATCH` — Addon outside budget range
- `AGE_MISMATCH` — Addon outside age range
- `GUESTS_MISMATCH` — Addon outside guests range

### User actions on conflicts:
- View conflicts in UI
- Remove conflicted addon
- Replace base to resolve conflict
- Choose alternative addon

## Next Steps (NOT done yet)

1. Create UI components for builder flow
2. Create step screens (basics, place, entertainment, food, decor)
3. Create summary screen with conflict display
4. Create confirmation screen for request targets
5. Wire new builder into route `/birthday/builder`
6. Test full flow
7. Migrate `/birthday` to new builder
8. Remove old quiz code

## Old Code (NOT touched)

- `quiz/` folder — old quiz implementation still works
- `/birthday` route — still uses old quiz
- All old components intact
