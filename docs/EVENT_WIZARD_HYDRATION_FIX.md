# Event Wizard Hydration Error Fix

## Problem
После обновления структуры данных Event Wizard (Phase 3) возникла hydration ошибка из-за несовместимости старых данных в localStorage с новой структурой.

## Root Cause
1. **Old structure**: `dates` был массивом объектов `EventDate[]` с полями `{id, date, allDay, startTime, endTime}`
2. **New structure**: `dates` теперь массив строк `string[]` (YYYY-MM-DD)
3. localStorage содержал старую структуру, что вызывало:
   - Hydration mismatch в checkboxes
   - Runtime error при рендере дат

## Solution

### 1. Data Migration in EventWizard
Добавлена миграция при загрузке из localStorage:

```typescript
// Migrate old structure to new structure
const migrated = {
  ...defaults,
  ...parsed,
  // Convert EventDate[] to string[]
  dates: Array.isArray(parsed.dates) 
    ? parsed.dates.map((d: any) => typeof d === 'string' ? d : d.date || '')
    : [],
  // Migrate renamed fields
  ageGroups: parsed.ageGroups || parsed.age || [],
  fullDescription: parsed.fullDescription || parsed.description || "",
  reelsUrl: parsed.reelsUrl || parsed.videoLink || "",
  locationMode: parsed.locationMode === "existing" ? "place" : parsed.locationMode || "place",
  // Flatten manualLocation
  venueName: parsed.venueName || parsed.manualLocation?.venueName || "",
  address: parsed.address || parsed.manualLocation?.address || "",
  city: parsed.city || parsed.manualLocation?.city || "",
  socialLinks: parsed.socialLinks || parsed.socialNetworks || [],
};
```

### 2. One-Time Cleanup
Добавлен useEffect для очистки старых данных:

```typescript
useEffect(() => {
  if (mode === "create") {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Check if it's old structure
      if (parsed.dates && parsed.dates.length > 0 && typeof parsed.dates[0] === 'object') {
        console.log("Migrating old event wizard data structure");
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
  }
}, [mode]);
```

## Manual Fix (if needed)

If you still see hydration errors, clear localStorage manually:

### Option 1: Browser Console
```javascript
localStorage.removeItem('event-wizard-draft');
location.reload();
```

### Option 2: Clear All Site Data
1. Open DevTools (F12)
2. Go to Application tab
3. Click "Clear site data"
4. Refresh page

## Prevention

Going forward:
1. Always version localStorage data with schema version
2. Add migration logic for breaking changes
3. Consider using a library like `zod` for runtime validation
4. Add data version field to detect incompatible structures

## Files Modified
- `src/components/business/wizard/event/EventWizard.tsx` - added migration logic
- `scripts/clear-event-wizard-cache.ts` - helper script
- `docs/EVENT_WIZARD_HYDRATION_FIX.md` - this document

## Testing
1. Clear localStorage
2. Navigate to `/business/events/new`
3. Fill some fields
4. Refresh page
5. Verify data persists correctly
6. No hydration errors should appear
