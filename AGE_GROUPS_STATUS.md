# Age Groups Implementation - Status

## Current Status: PARTIALLY COMPLETE

### ✅ Completed

#### 1. Shared Configuration
**File**: `src/features/filters/age/ageGroups.ts`

Single source of truth with:
- 10 age groups (0-1 to 18+)
- Russian labels
- Age ranges in years and months
- Helper functions:
  - `getAgeGroupByValue(value)`
  - `getAgeGroupByMonths(minMonths, maxMonths)`
  - `ageRangeOverlaps(itemMin, itemMax, selectedMin, selectedMax)`

#### 2. Database Schema
**Updated**: `prisma/schema.prisma`

Added age fields to:
- `Activity` model: `ageMinMonths Int?`, `ageMaxMonths Int?`
- `Place` model: `ageMinMonths Int?`, `ageMaxMonths Int?`
- `Offer` model: Already had these fields

Added indexes:
```prisma
@@index([ageMinMonths, ageMaxMonths])
```

#### 3. Migration Created
**File**: `prisma/migrations/20260303111941_add_age_fields_to_publications/migration.sql`

Migration ready but NOT YET APPLIED.

### ⏳ Pending

#### 1. Apply Migration
```bash
pnpm prisma migrate dev
```

#### 2. Create/Update Forms
Need to add age group selector to:
- Activity create/edit forms
- Place create/edit forms (Business Cabinet)
- Offer create/edit forms (Business Cabinet)

Form implementation:
- Single select dropdown
- Options from `AGE_GROUPS` array
- On select: set `ageMinMonths` and `ageMaxMonths` from selected group
- Display selected label in UI

#### 3. Update Discovery Filtering
Update filtering logic to use:
```typescript
import { ageRangeOverlaps } from '@/features/filters/age/ageGroups';

// Filter items
const filtered = items.filter(item => 
  ageRangeOverlaps(
    item.ageMinMonths,
    item.ageMaxMonths,
    selectedGroup.minMonths,
    selectedGroup.maxMonths
  )
);
```

#### 4. Validation
Add validation rules:
- `ageMinMonths >= 0`
- `ageMaxMonths >= ageMinMonths`
- For drafts: optional
- For publish: required

## Next Steps

### Step 1: Apply Migration
```bash
pnpm prisma migrate dev
pnpm prisma generate
```

### Step 2: Find Forms
Locate create/edit forms for:
- Activities (admin side)
- Places (business cabinet)
- Offers (business cabinet)

### Step 3: Add Age Selector Component
Create reusable component:
```typescript
// src/components/forms/AgeGroupSelect.tsx
import { AGE_GROUPS } from '@/features/filters/age/ageGroups';

export function AgeGroupSelect({ value, onChange }) {
  return (
    <select 
      value={value}
      onChange={(e) => {
        const group = getAgeGroupByValue(e.target.value);
        onChange({
          value: e.target.value,
          minMonths: group.minMonths,
          maxMonths: group.maxMonths
        });
      }}
    >
      <option value="">Выберите возраст</option>
      {AGE_GROUPS.map(group => (
        <option key={group.value} value={group.value}>
          {group.label}
        </option>
      ))}
    </select>
  );
}
```

### Step 4: Update Discovery Filter
Integrate age filtering in discovery page using `ageRangeOverlaps()`.

### Step 5: Test
- Create activity/place/offer with age group
- Verify DB stores correct months
- Test discovery filtering
- Verify overlap logic works correctly

## Files

### Created
- `src/features/filters/age/ageGroups.ts`
- `prisma/migrations/20260303111941_add_age_fields_to_publications/`

### Modified
- `prisma/schema.prisma`

### To Create
- Age selector component
- Form updates for Activity/Place/Offer
- Discovery filter integration

## Migration Status
```bash
$ pnpm prisma migrate status

Following migration have not yet been applied:
20260303111941_add_age_fields_to_publications
```

⚠️ Migration must be applied before forms can use the new fields.
