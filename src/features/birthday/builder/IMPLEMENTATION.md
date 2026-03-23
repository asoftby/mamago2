# Birthday Builder — UI Flow Implementation

Progressive birthday builder with base/addon separation, conflict handling, and request confirmation.

## Created Files

### Main Orchestrator
- `builder/components/BirthdayBuilderShell.tsx` — Main flow controller

### Step Components
- `builder/components/steps/StepBasics.tsx` — Age + Budget + Guests selection
- `builder/components/steps/StepPlace.tsx` — Place type + Base venue/package selection
- `builder/components/steps/StepAddons.tsx` — Unified addons step (entertainment/food/decor)
- `builder/components/steps/StepSummary.tsx` — Final summary with conflicts display
- `builder/components/steps/StepConfirmation.tsx` — Request targets confirmation

### Entry Point
- `app/(public)/birthday/builder/page.tsx` — Test route at `/birthday/builder`

## Reused Components

From existing birthday quiz:
- `BirthdayOptionCard` — Selection cards
- `BirthdayOfferCard` — Offer display cards
- `BirthdayQuizIntro` — Intro screen

## Flow Structure

```
intro → basics → place → entertainment → food → decor → summary → confirm
         ↓         ↓          ↓            ↓       ↓        ↓         ↓
      required  required   optional    optional optional required  required
```

### Step Details

**1. Intro**
- Reuses `BirthdayQuizIntro`
- CTA: "Начать подбор"

**2. Basics**
- Age group (4 options)
- Budget group (4 options)
- Guests group (4 options)
- All required
- CTA: "Далее — выбрать место"

**3. Place**
- Place type selection (HOME/VENUE/OUTDOOR/PACKAGE)
- Base offers grid (venues/packages)
- Select ONE base (authoritative)
- Selected base highlighted with ring
- CTA: "Далее — добавить развлечения"

**4. Entertainment / Food / Decor**
- Unified `StepAddons` component
- Layer-based filtering (ENTERTAINMENT/FOOD/DECOR)
- Multiple selection allowed
- Conflicts displayed with red ring + "Конфликт" badge
- Conflicts banner at top if any
- CTAs: "Пропустить" | "Далее"

**5. Summary**
- Shows selected base
- Shows selected addons
- Conflicts banner if any
- Each offer has delete button
- Estimated budget display
- CTAs:
  - "Праздник готов — отправить заявки" (disabled if conflicts)
  - "Изменить площадку"
  - "Начать заново"

**6. Confirmation**
- Groups offers by business
- Checkboxes for each business
- Shows offer count per business
- CTA: "Отправить заявки (N)"
- After submit: success screen

## Conflict UX

### When conflicts occur:
1. Conflicted addons get red ring + opacity
2. Banner appears at top with explanation
3. "Конфликт" badge on offer card
4. Button shows "Конфликт" instead of "Добавить"
5. Summary step blocks proceed if conflicts exist

### User actions on conflicts:
- Remove conflicted addon (delete button)
- Change base (go back to place step)
- View conflict reasons in banner

## Key Features

### Base is Authoritative
- Only ONE base can be selected
- Selecting new base replaces old one
- All addons revalidate against new base

### Addons are Dependent
- Multiple addons allowed
- Each addon checked for compatibility with base
- Incompatible addons marked as conflicts

### Conflicts are Explicit
- Never silently removed
- Always shown with reason
- User must take action

### Selection is Reversible
- Delete button on every offer
- "Изменить площадку" button
- "Начать заново" button
- Back navigation on every step

### Steps are Optional
- Entertainment can be skipped
- Food can be skipped
- Decor can be skipped
- "Пропустить" button on each

## Testing

Visit: `http://localhost:3000/birthday/builder`

Old quiz still works at: `http://localhost:3000/birthday`

## What's Left

### To complete full migration:

1. **More mock data** — Currently only 7 offers, need full 36
2. **Filtering logic** — Apply age/budget/guests filters to candidates
3. **Ranking logic** — Sort by featured/rating
4. **"Показать другие" action** — Refresh candidates
5. **Mobile optimization** — Test responsive layout
6. **Backend integration** — Real request submission
7. **Persistence** — Save state to localStorage
8. **Analytics** — Track step completion
9. **Switch `/birthday` route** — Point to new builder
10. **Remove old quiz code** — Clean up after migration

## Architecture Decisions

### Why unified StepAddons?
- Entertainment/Food/Decor have identical UX
- Only differ by layer filter
- Reduces code duplication
- Easier to maintain

### Why separate confirmation step?
- Explicit user consent before sending requests
- Allows deselecting specific businesses
- Clear separation of "assembly" vs "submission"
- Better UX than silent send

### Why conflicts not auto-removed?
- User should see what broke
- User should decide what to do
- Transparent > magical
- Prevents confusion

## State Flow

```typescript
// User selects base
selectBase(offerId)
  → state.selection.selectedBaseId = offerId
  → revalidateAddons()
    → compatible addons stay selected
    → incompatible addons → conflicts[]

// User toggles addon
toggleAddon(offerId)
  → add/remove from selectedAddonIds
  → revalidateAddons()
    → check compatibility with current base
    → update conflicts[]

// User removes offer
removeSelectedOffer(offerId)
  → if base: clear selectedBaseId, clear conflicts
  → if addon: remove from selectedAddonIds, revalidate
```

## Next Steps

1. Test full flow in browser
2. Add remaining mock offers
3. Implement filtering/ranking
4. Add mobile polish
5. Switch main route
6. Remove old code
