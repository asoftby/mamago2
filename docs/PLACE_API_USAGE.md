# Place API - Usage Guide

## Quick Reference

### Base URL
```
/api/business/places
```

### Authentication
All endpoints require:
- Valid session cookie
- Role: BUSINESS_OWNER
- Ownership check (for specific place operations)

## Endpoints

### Create Place
```typescript
POST /api/business/places

// Request
{
  "title": "My Cafe",
  "category": "cafe",
  "shortDesc": "A cozy cafe"
}

// Response
{
  "place": {
    "id": "...",
    "status": "DRAFT",
    ...
  }
}
```

### List Places
```typescript
GET /api/business/places?status=DRAFT

// Response
{
  "places": [...]
}
```

### Get Place
```typescript
GET /api/business/places/[id]

// Response
{
  "place": {...}
}
```

### Update Place (Autosave)
```typescript
PATCH /api/business/places/[id]

// Request (partial)
{
  "title": "Updated Title",
  "description": "Full description",
  "phone": "+375291234567"
}

// Response
{
  "place": {...}
}
```

### Set Google Location
```typescript
POST /api/business/places/[id]/location/google

// Request
{
  "googlePlaceId": "ChIJ...",
  "lat": 53.9006,
  "lng": 27.559,
  "formattedAddr": "ул. Ленина 10, Минск"
}

// Response
{
  "place": {
    "locationSource": "GOOGLE",
    ...
  }
}

// Error (409 if duplicate)
{
  "error": "DUPLICATE_GOOGLE_PLACE_ID",
  "duplicate": {
    "id": "...",
    "title": "Dana Mall",
    "placeKind": "COMPLEX"
  }
}
```

### Set Manual Location
```typescript
POST /api/business/places/[id]/location/manual

// Request
{
  "lat": 53.9,
  "lng": 27.55,
  "customAddress": "Somewhere in Minsk"
}

// Response
{
  "place": {
    "locationSource": "MANUAL",
    ...
  }
}
```

### Submit for Moderation
```typescript
POST /api/business/places/[id]/submit

// Response (success)
{
  "success": true,
  "place": {
    "status": "PENDING",
    ...
  }
}

// Response (validation error)
{
  "error": "VALIDATION",
  "missing": ["logoImageId"],
  "fields": {
    "logoImageId": "Logo image is required"
  }
}
```

### Delete Place
```typescript
DELETE /api/business/places/[id]

// Response
{
  "success": true
}
```

## React Hook Example

```typescript
// hooks/usePlaceForm.ts
import { useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";

export function usePlaceForm(placeId?: string) {
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Create new place
  const createPlace = async (data: {
    title: string;
    category: string;
    shortDesc: string;
  }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/business/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to create place");

      const { place } = await res.json();
      setPlace(place);
      return place;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Autosave (debounced)
  const updatePlace = useDebounce(async (updates: Partial<Place>) => {
    if (!placeId) return;

    try {
      const res = await fetch(`/api/business/places/${placeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error("Failed to update place");

      const { place } = await res.json();
      setPlace(place);
    } catch (err) {
      console.error("Autosave error:", err);
    }
  }, 500);

  // Set Google location
  const setGoogleLocation = async (data: {
    googlePlaceId: string;
    lat: number;
    lng: number;
    formattedAddr?: string;
  }) => {
    if (!placeId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/business/places/${placeId}/location/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.status === 409) {
        const { duplicate } = await res.json();
        return { duplicate };
      }

      if (!res.ok) throw new Error("Failed to set location");

      const { place } = await res.json();
      setPlace(place);
      return { place };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Submit for moderation
  const submitPlace = async () => {
    if (!placeId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/business/places/${placeId}/submit`, {
        method: "POST",
      });

      const data = await res.json();

      if (data.error === "VALIDATION") {
        return { validationError: data };
      }

      if (!res.ok) throw new Error("Failed to submit place");

      setPlace(data.place);
      return { success: true, place: data.place };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    place,
    loading,
    error,
    createPlace,
    updatePlace,
    setGoogleLocation,
    submitPlace,
  };
}
```

## Component Example

```tsx
// components/PlaceForm.tsx
"use client";

import { useState } from "react";
import { usePlaceForm } from "@/hooks/usePlaceForm";

export function PlaceForm() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [shortDesc, setShortDesc] = useState("");

  const { place, loading, createPlace, updatePlace, submitPlace } = usePlaceForm(
    place?.id
  );

  const handleCreate = async () => {
    const newPlace = await createPlace({ title, category, shortDesc });
    console.log("Created:", newPlace.id);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (place) {
      updatePlace({ title: value }); // Debounced autosave
    }
  };

  const handleSubmit = async () => {
    const result = await submitPlace();

    if (result.validationError) {
      console.error("Validation errors:", result.validationError.missing);
      // Show errors in UI
    } else {
      console.log("Submitted successfully!");
      // Redirect to success page
    }
  };

  return (
    <form>
      <input
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Title"
      />
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Category"
      />
      <textarea
        value={shortDesc}
        onChange={(e) => setShortDesc(e.target.value)}
        placeholder="Short description"
      />

      {!place && (
        <button type="button" onClick={handleCreate} disabled={loading}>
          Create Place
        </button>
      )}

      {place && (
        <button type="button" onClick={handleSubmit} disabled={loading}>
          Submit for Moderation
        </button>
      )}
    </form>
  );
}
```

## Validation Handling

```typescript
const result = await fetch(`/api/business/places/${placeId}/submit`, {
  method: "POST",
}).then((r) => r.json());

if (result.error === "VALIDATION") {
  // Show validation errors
  result.missing.forEach((field) => {
    console.error(`Missing: ${field}`);
    console.error(`Message: ${result.fields[field]}`);
  });

  // Example: highlight fields in UI
  setErrors({
    title: result.fields.title,
    logoImageId: result.fields.logoImageId,
    location: result.fields.location,
  });
}
```

## Duplicate Handling

```typescript
const result = await fetch(`/api/business/places/${placeId}/location/google`, {
  method: "POST",
  body: JSON.stringify({
    googlePlaceId: selectedPlace.place_id,
    lat: selectedPlace.geometry.location.lat(),
    lng: selectedPlace.geometry.location.lng(),
  }),
}).then((r) => r.json());

if (result.error === "DUPLICATE_GOOGLE_PLACE_ID") {
  const { duplicate } = result;

  if (duplicate.placeKind === "COMPLEX") {
    // Show UI: "This is inside a complex"
    setShowComplexDialog(true);
    setComplex(duplicate);
  } else {
    // Show UI: "This place already exists"
    setShowExistingPlaceDialog(true);
    setExistingPlace(duplicate);
  }
}
```

## Best Practices

1. **Autosave**: Use debounced updates (500ms) for better UX
2. **Validation**: Show validation errors inline, not just on submit
3. **Loading states**: Show spinners during API calls
4. **Error handling**: Catch and display errors gracefully
5. **Optimistic updates**: Update UI immediately, rollback on error
6. **Status checks**: Disable submit button if status !== DRAFT/REJECTED/NEEDS_CHANGES
7. **Duplicate detection**: Check for duplicates before allowing submit
8. **Image upload**: Upload images first, then link to place
9. **Progress indicator**: Show wizard progress (step 1/4, 2/4, etc.)
10. **Confirmation**: Ask for confirmation before deleting place

## Error Codes

- `401` - Unauthorized (not logged in or not BUSINESS_OWNER)
- `403` - Forbidden (not owner of place)
- `404` - Place not found
- `400` - Validation error or wrong status
- `409` - Duplicate googlePlaceId
- `500` - Internal server error
