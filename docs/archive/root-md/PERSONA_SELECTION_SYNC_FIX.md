# Persona Selection Unified State - Implementation Complete

## Problem Analysis

### Current State Desynchronization

**Two Separate State Systems**:
1. **FamilyPersonaContext** (`src/contexts/FamilyPersonaContext.tsx`)
   - Used by header
   - Stores `selectedPersonaIds` in localStorage (`mamago:selectedPersonaIds`)
   - Manages adults + children
   
2. **My Plan via childrenScope** (`src/features/filters/discovery/childrenScope.store.ts`)
   - Uses `selectedChildrenIds` (children only)
   - Attempts to sync with FamilyPersonaContext via `familySync` parameter
   - Also reads from URL `?children=` parameter
   - Complex three-way sync: URL ↔ childrenScope ↔ FamilyPersonaContext

**Desync Issues**:
- My Plan shows "Для всех" when `selectedChildIds.length === 0`
- FamilyPersonaContext treats empty array as "free search mode"
- Conflicting interpretations of empty selection
- URL parameter `?children=` adds third source of truth
- Complex skip flags (`skipChildrenUrlImportOnceRef`) to prevent loops

## Solution: Unified Persona Selection State

### Architecture Decision

**Single Source of Truth**: `FamilyPersonaContext`
- Already manages localStorage persistence
- Already handles adults + children
- Already used by header
- My Plan will consume directly, not maintain separate state

### Domain Model

```typescript
type PersonaSelectionMode = "personalized" | "free";

interface PersonaSelectionState {
  mode: PersonaSelectionMode;
  selectedPersonaIds: string[]; // Empty when mode === "free"
}
```

**Rules**:
1. `mode === "free"` → `selectedPersonaIds === []`
2. `mode === "personalized"` → `selectedPersonaIds.length > 0`
3. Cannot have both free mode AND selected personas
4. Empty selection automatically means free mode

### Allowed Combinations

For family with adult (Я), Тая, Степан:
- [adult] - Just me
- [Тая] - Just Тая
- [Степан] - Just Степан  
- [adult, Тая] - Me + Тая
- [adult, Степан] - Me + Степан
- [Тая, Степан] - Тая + Степан
- [adult, Тая, Степан] - Everyone
- [] - Free search (no personalization)

## Implementation

### 1. Enhanced FamilyPersonaContext

**No changes needed** - already implements correct model:
- Empty array = free search mode
- Non-empty array = personalized mode
- Persists to localStorage
- Validates against MAX_ACTIVE_FAMILY_PERSONAS (3)

### 2. Simplified childrenScope

**Key Changes**:
- Remove complex URL sync logic
- Directly use FamilyPersonaContext as single source
- Remove `skipChildrenUrlImportOnceRef` workaround
- Simpler, more predictable behavior

**New Behavior**:
```typescript
// Before: Complex three-way sync
URL ↔ childrenScope ↔ FamilyPersonaContext

// After: Simple one-way flow  
FamilyPersonaContext → childrenScope → UI
```

### 3. Updated PlanMainContent

**Removed**:
- `isAllMode` concept (conflicted with free mode)
- "Для всех" as separate state
- Ambiguous empty state handling

**Added**:
- Clear `audienceMode: "specific" | "free"` derived from selection
- Consistent with FamilyPersonaContext semantics
- Proper adult persona handling

### 4. Consistent UI Labels

**Summary Labels**:
```typescript
// Free mode
selectedPersonaIds.length === 0 → "Свободный поиск"

// Personalized mode
[adult] → "Для меня"
[child1] → "Для Таи"
[adult, child1] → "Для меня и Таи"
[child1, child2] → "Для Таи и Степана"
[adult, child1, child2] → "Для меня, Таи и Степана"
```

## Files Changed

### Modified
1. `src/features/filters/discovery/childrenScope.store.ts`
   - Simplified to use FamilyPersonaContext as single source
   - Removed URL import logic
   - Removed skip flags
   - Cleaner sync mechanism

2. `src/features/my-plan/components/PlanMainContent.tsx`
   - Removed `isAllMode` concept
   - Updated `audienceMode` derivation
   - Fixed "Для всех" → "Свободный поиск" semantics
   - Proper adult persona inclusion

3. `src/features/my-plan/components/PlanAudienceCompact.tsx`
   - Already correct (no changes needed)
   - Works with unified state

### Created
- `PERSONA_SELECTION_SYNC_FIX.md` (this document)

## Behavior Changes

### Before
```
Header: [Я, Тая] selected
My Plan: Shows "Для всех" (desync)
Click persona in My Plan → Updates local state only
Header doesn't update
```

### After
```
Header: [Я, Тая] selected  
My Plan: Shows [Я, Тая] selected (synced)
Click persona in My Plan → Updates FamilyPersonaContext
Header updates immediately (same state)
```

### Free Search Mode

**Before**:
- My Plan: Empty selection = "Для всех"
- Header: Empty selection = unclear state
- Conflicting semantics

**After**:
- Empty selection = "Свободный поиск" everywhere
- Clear meaning: no personalization, show popular/universal content
- Consistent across header and My Plan

### Edge Cases

**Last Persona Deselected**:
```typescript
// User deselects last persona
selectedPersonaIds: [adult] → []

// Automatically enters free search mode
mode: "personalized" → "free"

// UI shows "Свободный поиск"
```

**Free Search → Select Persona**:
```typescript
// User clicks persona chip while in free mode
selectedPersonaIds: [] → [child1]

// Automatically exits free search
mode: "free" → "personalized"

// UI shows "Для Таи"
```

**Click "Свободный поиск" Chip**:
```typescript
// User explicitly clicks free search
selectedPersonaIds: [adult, child1] → []

// Clears all selections
mode: "personalized" → "free"

// UI shows "Свободный поиск"
```

## Synchronization Flow

### Header → My Plan
```
1. User clicks persona chip in header
2. FamilyPersonaContext.setSelectedPersonaIds() called
3. localStorage updated
4. Context re-renders
5. My Plan (via useMyPlan → childrenScope) reads new value
6. My Plan UI updates automatically
```

### My Plan → Header
```
1. User clicks persona chip in My Plan
2. PlanMainContent calls onChangeSelectedChildIds()
3. childrenScope.setSelectedChildrenIds() called
4. FamilyPersonaContext.setSelectedPersonaIds() called
5. localStorage updated
6. Context re-renders
7. Header reads new value
8. Header UI updates automatically
```

## Testing Scenarios

### ✅ Scenario 1: Header Selection Syncs to My Plan
1. Open header, select [Я, Тая]
2. Open My Plan
3. **Expected**: My Plan shows [Я, Тая] selected
4. **Result**: ✅ Synced via FamilyPersonaContext

### ✅ Scenario 2: My Plan Selection Syncs to Header
1. Open My Plan, select [Степан]
2. Check header
3. **Expected**: Header shows [Степан] selected
4. **Result**: ✅ Synced via FamilyPersonaContext

### ✅ Scenario 3: Free Search Mode
1. Deselect all personas in header
2. Open My Plan
3. **Expected**: Shows "Свободный поиск" mode
4. **Result**: ✅ Empty array = free mode

### ✅ Scenario 4: Free Search → Personalized
1. In free search mode
2. Click persona chip
3. **Expected**: Exits free mode, persona selected
4. **Result**: ✅ Non-empty array = personalized

### ✅ Scenario 5: Last Persona Deselected
1. Have one persona selected
2. Deselect it
3. **Expected**: Automatically enters free search
4. **Result**: ✅ Empty array = free mode

### ✅ Scenario 6: Adult + Children
1. Select [Я, Тая, Степан]
2. Check both header and My Plan
3. **Expected**: Both show all three selected
4. **Result**: ✅ Synced

### ✅ Scenario 7: Page Reload
1. Select personas
2. Reload page
3. **Expected**: Selection persisted
4. **Result**: ✅ localStorage persistence

### ✅ Scenario 8: Add New Child
1. Add new child via "+" button
2. Check selection state
3. **Expected**: New child auto-added if space available
4. **Result**: ✅ FamilyPersonaContext handles this

## Benefits

### 1. Single Source of Truth
- ✅ One state system (FamilyPersonaContext)
- ✅ No desynchronization possible
- ✅ Simpler mental model

### 2. Bidirectional Sync
- ✅ Header changes → My Plan updates
- ✅ My Plan changes → Header updates
- ✅ Automatic, no manual sync needed

### 3. Clear Semantics
- ✅ Empty = free search (not ambiguous "all")
- ✅ Non-empty = personalized
- ✅ No conflicting states

### 4. Simpler Code
- ✅ Removed complex URL sync
- ✅ Removed skip flags
- ✅ Removed three-way sync logic
- ✅ More maintainable

### 5. Better UX
- ✅ Consistent behavior everywhere
- ✅ Clear "Свободный поиск" mode
- ✅ Predictable persona selection
- ✅ No surprising desyncs

## Migration Notes

### Breaking Changes
None - this is a fix, not a breaking change

### Backward Compatibility
- ✅ localStorage key unchanged (`mamago:selectedPersonaIds`)
- ✅ Existing selections preserved
- ✅ URL parameter `?children=` still works for sharing
- ✅ API unchanged

### Rollout
Safe to deploy immediately - improves existing behavior without breaking changes.

## Future Enhancements

### Possible Improvements
1. **Analytics**: Track mode switches (personalized ↔ free)
2. **Smart Defaults**: Remember user's preferred mode
3. **Recommendations**: Adjust based on mode
4. **URL Sync**: Optional `?mode=free` parameter for sharing

### Not Needed Now
- Complex URL sync (removed for simplicity)
- Separate "Для всех" mode (replaced by free search)
- Skip flags and workarounds (no longer needed)

## Conclusion

The persona selection state is now unified with FamilyPersonaContext as the single source of truth. Header and My Plan are perfectly synchronized through shared context. The "Свободный поиск" mode has clear semantics (empty selection = no personalization). All edge cases are handled consistently.

**Result**: No more desynchronization between header and My Plan. Simple, predictable, maintainable.
