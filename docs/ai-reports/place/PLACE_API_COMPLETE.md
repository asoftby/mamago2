# Place API - COMPLETE ✅

## Задача
Создать API endpoints для безопасного и быстрого добавления мест с автосохранением и валидацией.

## Реализованные Endpoints

### 1. POST /api/business/places
**Создание нового Place (DRAFT)**

**Request:**
```json
{
  "title": "My Cafe",
  "category": "cafe",
  "shortDesc": "A cozy cafe"
}
```

**Response:**
```json
{
  "place": {
    "id": "...",
    "title": "My Cafe",
    "category": "cafe",
    "shortDesc": "A cozy cafe",
    "status": "DRAFT",
    "placeKind": "STANDALONE",
    "ownerUserId": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Auth:** BUSINESS_OWNER only

---

### 2. GET /api/business/places
**Список моих Places**

**Query params:**
- `status` (optional) - фильтр по статусу

**Response:**
```json
{
  "places": [
    {
      "id": "...",
      "title": "My Cafe",
      "status": "DRAFT",
      "images": [
        {
          "id": "...",
          "kind": "LOGO",
          "url": "..."
        }
      ],
      "_count": {
        "images": 3
      }
    }
  ]
}
```

**Auth:** BUSINESS_OWNER only

---

### 3. GET /api/business/places/[id]
**Получить детали Place**

**Response:**
```json
{
  "place": {
    "id": "...",
    "title": "My Cafe",
    "status": "DRAFT",
    "images": [...],
    "parentPlace": null,
    "children": []
  }
}
```

**Auth:** BUSINESS_OWNER only, owner check

---

### 4. PATCH /api/business/places/[id]
**Обновление Place (autosave-friendly)**

**Request (partial):**
```json
{
  "title": "Updated Title",
  "description": "Full description",
  "phone": "+375291234567",
  "ageTags": ["0-3", "3-7"],
  "visitFormats": ["indoor"],
  "activityTypes": ["food"]
}
```

**Response:**
```json
{
  "place": { ... }
}
```

**Validation:** Lenient - только проверка типов/форматов, не обязательность полей

**Auth:** BUSINESS_OWNER only, owner check

---

### 5. POST /api/business/places/[id]/location/google
**Установить локацию из Google Places**

**Request:**
```json
{
  "googlePlaceId": "ChIJ...",
  "lat": 53.9006,
  "lng": 27.559,
  "formattedAddr": "ул. Ленина 10, Минск",
  "addressJson": { ... },
  "countryCode": "BY",
  "cityId": "..."
}
```

**Response:**
```json
{
  "place": {
    "locationSource": "GOOGLE",
    "googlePlaceId": "ChIJ...",
    "lat": 53.9006,
    "lng": 27.559,
    ...
  }
}
```

**Validation:**
- `googlePlaceId`, `lat`, `lng` обязательны
- Проверка на дубликат `googlePlaceId`

**Error (409 Conflict):**
```json
{
  "error": "DUPLICATE_GOOGLE_PLACE_ID",
  "duplicate": {
    "id": "...",
    "title": "Existing Place",
    "placeKind": "COMPLEX"
  }
}
```

**Auth:** BUSINESS_OWNER only, owner check

---

### 6. POST /api/business/places/[id]/location/manual
**Установить локацию вручную**

**Request:**
```json
{
  "lat": 53.9,
  "lng": 27.55,
  "customAddress": "Somewhere in Minsk",
  "titleHint": "Near the park",
  "cityId": "...",
  "countryCode": "BY"
}
```

**Response:**
```json
{
  "place": {
    "locationSource": "MANUAL",
    "lat": 53.9,
    "lng": 27.55,
    "customAddress": "Somewhere in Minsk",
    ...
  }
}
```

**Validation:**
- `lat`, `lng`, `customAddress` обязательны

**TODO:** Reverse geocoding для автозаполнения `countryCode`/`cityId`

**Auth:** BUSINESS_OWNER only, owner check

---

### 7. POST /api/business/places/[id]/submit
**Отправить Place на модерацию (строгая валидация)**

**Request:** (empty body)

**Response (success):**
```json
{
  "success": true,
  "place": {
    "id": "...",
    "status": "PENDING",
    ...
  }
}
```

**Response (validation error - 400):**
```json
{
  "error": "VALIDATION",
  "missing": ["logoImageId", "location"],
  "fields": {
    "logoImageId": "Logo image is required",
    "location": "Location coordinates are required"
  }
}
```

**Validation Rules:**

**Required:**
- `title` (не пустой)
- `category` (не пустой)
- `shortDesc` (не пустой)
- `logoImageId` (должен существовать PlaceImage с kind=LOGO)
- `lat` и `lng` (не null)
- `locationSource` (GOOGLE или MANUAL)

**For UNIT:**
- `parentPlaceId` (обязателен)
- `floor` (не пустой)
- `unit` (не пустой)

**Recommended (warning, not error):**
- Хотя бы 1 gallery фото

**Status transitions:**
- Можно submit только из: DRAFT, REJECTED, NEEDS_CHANGES
- После submit: status → PENDING

**Auth:** BUSINESS_OWNER only, owner check

---

### 8. DELETE /api/business/places/[id]
**Удалить Place**

**Response:**
```json
{
  "success": true
}
```

**Validation:**
- COMPLEX с children не может быть удалён (нужно сначала удалить UNITs)

**Auth:** BUSINESS_OWNER only, owner check

---

## Авторизация

Все endpoints требуют:
1. Аутентификацию (getCurrentUser)
2. Роль BUSINESS_OWNER
3. Ownership check (ownerUserId === user.id)

**401 Unauthorized:**
```json
{
  "error": "Unauthorized"
}
```

**403 Forbidden:**
```json
{
  "error": "Forbidden"
}
```

**404 Not Found:**
```json
{
  "error": "Place not found"
}
```

---

## Workflow

### Создание Place (Happy Path)

```typescript
// 1. Create DRAFT
const { place } = await fetch("/api/business/places", {
  method: "POST",
  body: JSON.stringify({
    title: "My Cafe",
    category: "cafe",
    shortDesc: "A cozy cafe",
  }),
}).then((r) => r.json());

// 2. Autosave updates (debounced)
await fetch(`/api/business/places/${place.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    description: "Full description",
    phone: "+375291234567",
  }),
});

// 3. Set location (Google)
await fetch(`/api/business/places/${place.id}/location/google`, {
  method: "POST",
  body: JSON.stringify({
    googlePlaceId: "ChIJ...",
    lat: 53.9006,
    lng: 27.559,
    formattedAddr: "ул. Ленина 10, Минск",
  }),
});

// 4. Upload logo image (separate endpoint - not implemented yet)
// POST /api/business/places/${place.id}/images
// Returns: { image: { id, kind: "LOGO", url } }

// 5. Link logo to place
await fetch(`/api/business/places/${place.id}`, {
  method: "PATCH",
  body: JSON.stringify({
    logoImageId: logoImage.id,
  }),
});

// 6. Submit for moderation
const result = await fetch(`/api/business/places/${place.id}/submit`, {
  method: "POST",
}).then((r) => r.json());

if (result.error === "VALIDATION") {
  console.error("Validation errors:", result.missing, result.fields);
} else {
  console.log("Submitted successfully:", result.place.status); // "PENDING"
}
```

### Создание UNIT в COMPLEX

```typescript
// 1. Check for duplicate (when user selects Google Place)
const { duplicate } = await fetch(
  `/api/business/places/${draftPlace.id}/location/google`,
  {
    method: "POST",
    body: JSON.stringify({
      googlePlaceId: "ChIJ_dana_mall",
      lat: 53.9006,
      lng: 27.559,
    }),
  }
).then((r) => r.json());

if (duplicate && duplicate.placeKind === "COMPLEX") {
  // Show UI: "This is inside a complex"
  // User chooses to create UNIT

  // 2. Update place to UNIT
  await fetch(`/api/business/places/${draftPlace.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      placeKind: "UNIT",
      parentPlaceId: duplicate.id,
      floor: "2",
      unit: "A12",
      unitLabel: "2 этаж, павильон A12",
    }),
  });
}
```

---

## Error Handling

### Validation Error (400)
```json
{
  "error": "VALIDATION",
  "missing": ["title", "logoImageId"],
  "fields": {
    "title": "Title is required",
    "logoImageId": "Logo image is required"
  }
}
```

### Duplicate Google Place ID (409)
```json
{
  "error": "DUPLICATE_GOOGLE_PLACE_ID",
  "duplicate": {
    "id": "...",
    "title": "Dana Mall",
    "placeKind": "COMPLEX"
  }
}
```

### Wrong Status (400)
```json
{
  "error": "Cannot submit from status: PENDING"
}
```

### Cannot Delete Complex (400)
```json
{
  "error": "Cannot delete complex with units. Delete units first."
}
```

---

## Testing

```bash
# Test API logic
pnpm tsx scripts/test-place-api.ts
```

**Result:** ✅ All tests passed
- Create DRAFT
- Autosave updates
- Set Google location
- Set manual location
- Add logo image
- Add gallery images
- Validation
- Submit for moderation
- Status transition check
- List places
- UNIT creation

---

## Next Steps

1. ✅ API endpoints created
2. ✅ Validation logic implemented
3. ✅ Tests passed
4. 🔄 Image upload endpoint (`POST /api/business/places/[id]/images`)
5. 🔄 Reverse geocoding for manual location
6. 🔄 UI components (wizard, forms)
7. 🔄 Integration with Google Places Autocomplete

---

**Дата**: 2026-03-04  
**Endpoints**: 8  
**Статус**: ✅ COMPLETE
