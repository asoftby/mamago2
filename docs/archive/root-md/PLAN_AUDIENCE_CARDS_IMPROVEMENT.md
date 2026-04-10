# Plan Audience Cards Improvement - Complete ✅

## Overview
Enhanced PlanAudienceSheet cards to show meaningful context (age, interests, roles, preferences) without overloading the UI or turning it into a profile editor.

## Changes Made

### 1. Children Cards - Age + Interests ✅

**Before**:
```
Тая
август 2014 г.
```

**After**:
```
Тая (10 лет)
творчество, животные
```

**Implementation**:
- Line 1: Name + age in parentheses
  - Age calculated from birthDate
  - Proper Russian plural forms: "1 год", "2 года", "5 лет"
  - No full birth date shown
- Line 2 (optional): Interests from `preferenceSummary`
  - Muted text style: `text-xs text-neutral-500`
  - Hidden if no interests
  - Spacing: `mt-1` (4px)

**Code**:
```typescript
const age = calculateAge(child.birthDate);
const interests = child.preferenceSummary?.trim();

<p className="font-medium text-neutral-900">
  {child.displayName}
  {age !== null ? (
    <span className="text-neutral-500"> ({formatAge(age)})</span>
  ) : null}
</p>
{interests ? (
  <p className="mt-1 text-xs leading-relaxed text-neutral-500">
    {interests}
  </p>
) : null}
```

### 2. Adult Cards - Role + Preferences ✅

**Before**:
```
Я
мама
```

**After**:
```
Алексей (папа)
активный отдых, кафе
```

**Implementation**:
- Line 1: Name + role in parentheses
  - Role from `familyRole` (мама, папа, взрослый, etc.)
  - Inline style, not separate line
- Line 2 (optional): Preferences
  - Uses `leisureFormatSummary` or falls back to `preferenceSummary`
  - Muted text style: `text-xs text-neutral-500`
  - Hidden if no preferences
  - Spacing: `mt-1` (4px)

**Code**:
```typescript
const role = adult.familyRole?.trim();
const preferences = adult.leisureFormatSummary?.trim() || adult.preferenceSummary?.trim();

<p className="font-medium text-neutral-900">
  {adult.displayName}
  {role ? (
    <span className="text-neutral-500"> ({role})</span>
  ) : null}
</p>
{preferences ? (
  <p className="mt-1 text-xs leading-relaxed text-neutral-500">
    {preferences}
  </p>
) : null}
```

### 3. "Для всех" Block - Updated Description ✅

**Before**:
```
Для всех
Общие рекомендации без персонализации
```

**After**:
```
Для всех
Без учёта профилей и интересов
```

More direct and clear about what "Для всех" means.

### 4. Helper Functions ✅

**calculateAge()**:
```typescript
function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  
  return age >= 0 ? age : null;
}
```

**formatAge()** - Russian plural forms:
```typescript
function formatAge(age: number): string {
  const lastDigit = age % 10;
  const lastTwoDigits = age % 100;
  
  // 11-14: "лет"
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${age} лет`;
  }
  
  // 1, 21, 31...: "год"
  if (lastDigit === 1) {
    return `${age} год`;
  }
  
  // 2-4, 22-24...: "года"
  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${age} года`;
  }
  
  // 0, 5-9, 10-20...: "лет"
  return `${age} лет`;
}
```

### 5. Visual Hierarchy ✅

**Primary text** (name + age/role):
- `font-medium text-neutral-900`
- Age/role in lighter color: `text-neutral-500`

**Secondary text** (interests/preferences):
- `text-xs leading-relaxed text-neutral-500`
- Muted, smaller, more line height for readability

**Spacing**:
- Between lines: `mt-1` (4px)
- Card padding: `p-3` (12px)
- No significant height increase

### 6. No Edit Buttons ✅

- No "Изменить" button per card
- Cards remain clean and focused on selection
- Keep selector role, not editor role

### 7. Selection UI ✅

- Maintained current selection style
- Border: `border-[#EF8759]`
- Background: `bg-[#EF8759]/5`
- Checkmark: `<Check className="h-5 w-5 text-[#EF8759]" />`
- Good readability with two lines

## Examples

### Child Card Examples

**With age and interests**:
```
Тая (10 лет)
творчество, животные, музыка
```

**With age, no interests**:
```
Степан (5 лет)
```

**No age data**:
```
Маша
спорт, танцы
```

### Adult Card Examples

**With role and preferences**:
```
Алексей (папа)
активный отдых, кафе, музеи
```

**With role, no preferences**:
```
Мария (мама)
```

**No role**:
```
Я
театр, выставки
```

## UX Benefits

1. **Fast scanning**: Age and role inline with name
2. **Meaningful context**: Interests/preferences help understand persona
3. **No overload**: Secondary info is muted and optional
4. **Clean design**: No nested controls or edit buttons
5. **Selector focus**: Screen remains a selector, not editor
6. **Better decisions**: Users can see who they're planning for

## Technical Details

**Data Sources**:
- Children:
  - Age: calculated from `birthDate`
  - Interests: `preferenceSummary`
- Adults:
  - Role: `familyRole`
  - Preferences: `leisureFormatSummary` (primary) or `preferenceSummary` (fallback)

**Graceful Degradation**:
- Missing age: show name only
- Missing interests: hide second line
- Missing role: show name only
- Missing preferences: hide second line

**Performance**:
- Age calculated once per render
- No expensive operations
- Simple string trimming and checks

## Files Modified

1. `src/features/my-plan/components/PlanAudienceSheet.tsx`
   - Added `calculateAge()` helper
   - Added `formatAge()` helper with Russian plurals
   - Updated children card rendering
   - Updated adult card rendering
   - Updated "Для всех" description

## Testing Checklist

- [x] No TypeScript errors
- [x] No React warnings
- [ ] Children with age show "Тая (10 лет)"
- [ ] Children with interests show second line
- [ ] Children without interests hide second line
- [ ] Adults with role show "Алексей (папа)"
- [ ] Adults with preferences show second line
- [ ] Adults without preferences hide second line
- [ ] Age plurals correct: "1 год", "2 года", "5 лет", "11 лет"
- [ ] "Для всех" shows new description
- [ ] Cards remain scannable and clean
- [ ] Selection still works correctly
- [ ] No visual overload

---

**Status**: Implementation complete, ready for visual testing
**Date**: 2026-04-04
**Task**: Plan Audience Cards Improvement
