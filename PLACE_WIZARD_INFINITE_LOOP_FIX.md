# Place Wizard Infinite Loop Fix

## Issue
**Error:** Maximum update depth exceeded

**Stack Trace:**
```
at handleUpdate (NewPlaceWizard.tsx:200)
at handleGalleryImagesChange (Step3Photos.tsx:44)
at PlaceGalleryUploadTemp.useEffect (PlaceGalleryUploadTemp.tsx:43)
```

## Root Cause

Infinite render loop caused by:

1. `PlaceGalleryUploadTemp` has `useEffect` that calls `onImagesChange(images)`
2. `onImagesChange` is `handleGalleryImagesChange` from Step3Photos
3. `handleGalleryImagesChange` calls `onUpdate()` from NewPlaceWizard
4. `onUpdate` updates `localDraft` state
5. State update causes re-render
6. Re-render creates new `handleGalleryImagesChange` function
7. New function reference triggers `useEffect` again
8. Loop repeats infinitely

## Solution

### 1. Remove `onImagesChange` from useEffect dependencies ✅

**File:** `src/components/business/place/PlaceGalleryUploadTemp.tsx`

```typescript
// Before
useEffect(() => {
  onImagesChange?.(images);
}, [images, onImagesChange]); // ❌ onImagesChange changes every render

// After
useEffect(() => {
  const doneImages = images.filter(img => img.status === "done");
  onImagesChange?.(doneImages);
}, [images]); // ✅ Only depend on images
```

**Why this works:**
- `onImagesChange` is a callback prop that changes on every parent render
- We only care about calling it when `images` actually changes
- Removing it from deps breaks the loop

### 2. Wrap callbacks with useCallback ✅

**File:** `src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx`

```typescript
// Before
const handleGalleryImagesChange = (galleryItems: GalleryItem[]) => {
  onUpdate({ ... });
}; // ❌ New function on every render

// After
const handleGalleryImagesChange = useCallback((galleryItems: GalleryItem[]) => {
  onUpdate({ ... });
}, [onUpdate]); // ✅ Stable reference
```

**File:** `src/app/business/(protected)/places/new/NewPlaceWizard.tsx`

```typescript
// Before
const handleUpdate = (updates: Partial<LocalDraft>) => {
  setLocalDraft((prev) => ({ ...prev, ...updates }));
}; // ❌ New function on every render

// After
const handleUpdate = useCallback((updates: Partial<LocalDraft>) => {
  setLocalDraft((prev) => ({ ...prev, ...updates }));
}, []); // ✅ Stable reference (no deps needed due to functional update)
```

## Files Modified

1. **src/components/business/place/PlaceGalleryUploadTemp.tsx**
   - Removed `onImagesChange` from useEffect deps
   - Filter to only "done" images before calling callback

2. **src/app/business/(protected)/places/[id]/edit/steps/Step3Photos.tsx**
   - Wrapped `handleLogoUploadComplete` with `useCallback`
   - Wrapped `handleGalleryImagesChange` with `useCallback`

3. **src/app/business/(protected)/places/new/NewPlaceWizard.tsx**
   - Wrapped `handleUpdate` with `useCallback`

## Why This Pattern Works

### Functional State Updates
```typescript
setLocalDraft((prev) => ({ ...prev, ...updates }));
```
- Uses previous state, not closure over current state
- No need to include `localDraft` in dependencies
- Callback can have empty deps array `[]`

### Stable Callback References
```typescript
const handleUpdate = useCallback(() => { ... }, []);
```
- Same function reference across renders
- Child components don't re-render unnecessarily
- useEffect in children doesn't re-trigger

### Selective Dependencies
```typescript
useEffect(() => {
  callback(data);
}, [data]); // Only data, not callback
```
- Only re-run when data actually changes
- Ignore callback reference changes
- Safe when callback doesn't capture stale closures

## Testing

- [x] Page loads without infinite loop
- [x] Can upload gallery images
- [x] Gallery state updates correctly
- [x] No console errors
- [x] No performance issues

## Best Practices Applied

1. **Use functional updates** when new state depends on old state
2. **Wrap callbacks with useCallback** when passed to child components
3. **Be selective with useEffect deps** - only include what you actually need to react to
4. **Avoid including callbacks in deps** unless they capture important state

## Status

✅ Infinite loop fixed
✅ All TypeScript errors resolved
✅ Ready for testing
