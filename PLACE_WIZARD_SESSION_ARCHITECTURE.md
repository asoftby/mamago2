# Place Wizard Session Architecture

## Overview
Implements wizard session-based media uploads that work WITHOUT creating Place records until final save.

## Key Principles
1. **Zero DB writes until final save** - No Place record created during wizard steps
2. **Immediate uploads** - Logo and gallery uploads work immediately via temp media storage
3. **Session-based** - All uploads linked to `wizardSessionId` (UUID)
4. **Single Place creation** - Only "Save Draft" or "Submit for Moderation" creates Place
5. **Idempotent** - Uses `createRequestId` to prevent duplicates
6. **Reusable** - Architecture works for Places, Activities, Offers

## Database Schema

### TempMedia Model
```prisma
model TempMedia {
  id               String          @id @default(cuid())
  ownerUserId      String
  wizardSessionId  String          // UUID for wizard session
  
  // File metadata
  url              String
  width            Int?
  height           Int?
  blurhash         String?
  mimeType         String?
  sizeBytes        Int?
  
  // Classification
  kind             TempMediaKind   // PLACE_LOGO | PLACE_GALLERY | ACTIVITY_COVER | etc.
  sortOrder        Int             @default(0)
  status           TempMediaStatus // TEMP | ATTACHED | DELETED
  
  // Attachment (set when entity is created)
  placeId          String?
  activityId       String?
  
  owner            User            @relation(fields: [ownerUserId], references: [id], onDelete: Cascade)
  
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  
  @@index([ownerUserId, wizardSessionId, status])
  @@index([wizardSessionId, kind, sortOrder])
  @@index([status, createdAt]) // For cleanup jobs
}

enum TempMediaKind {
  PLACE_LOGO
  PLACE_GALLERY
  ACTIVITY_COVER
  ACTIVITY_GALLERY
}

enum TempMediaStatus {
  TEMP      // Uploaded but not attached to entity
  ATTACHED  // Attached to entity (Place/Activity)
  DELETED   // Marked for deletion
}
```

## API Endpoints

### Temp Media APIs
```
POST   /api/business/temp-media
  - Upload temp media for wizard session
  - Body: { wizardSessionId, url, width, height, blurhash, kind, sortOrder }
  - Returns: { media }

GET    /api/business/temp-media?wizardSessionId=...
  - Get all temp media for session
  - Returns: { media: TempMedia[] }

POST   /api/business/temp-media/reorder
  - Reorder gallery items
  - Body: { wizardSessionId, orderedMediaIds: string[] }
  - Returns: { success: true }

DELETE /api/business/temp-media/[id]
  - Delete single temp media item
  - Returns: { success: true }

DELETE /api/business/temp-media/session/[sessionId]
  - Delete all temp media for session (on discard)
  - Returns: { success: true, deletedCount: number }
```

### Place Creation API (Enhanced)
```
POST   /api/business/places
  - Create Place and attach temp media
  - Body: {
      createRequestId: string,
      status: "DRAFT" | "PENDING",
      data: {
        ...placeFields,
        wizardSessionId?: string  // NEW: for attaching temp media
      }
    }
  - Process:
    1. Create Place record
    2. If wizardSessionId provided:
       a. Find all TEMP media for session
       b. Convert to PlaceImages
       c. Update Place.logoImageId if logo exists
       d. Mark temp media as ATTACHED
    3. Run geo enrichment
    4. Return Place with images
```

## Wizard Flow

### 1. Wizard Initialization
```typescript
// Generate wizardSessionId on mount
const { wizardSessionId, isLoaded, clearSession } = useWizardSession({
  userId: user.id,
  wizardType: "place",
});

// Store in localStorage: wizard_session_place_{userId}
// Format: { sessionId: "uuid", timestamp: Date.now() }
```

### 2. Step Navigation
```typescript
// All form data stored in React state (localDraft)
const [localDraft, setLocalDraft] = useState<LocalDraft>({
  title: "",
  category: "",
  // ... all fields
});

// Optionally persist to localStorage for reload recovery
useEffect(() => {
  saveState(localDraft);
}, [localDraft]);
```

### 3. Step 3: Photo Upload
```typescript
// Logo upload (immediate, no placeId needed)
<PlaceLogoUploadTemp
  wizardSessionId={wizardSessionId}
  currentLogoUrl={localDraft.logoUrl}
  onUploadComplete={(mediaId, url) => {
    setLocalDraft(prev => ({
      ...prev,
      logoMediaId: mediaId,
      logoUrl: url,
    }));
  }}
/>

// Gallery upload (immediate, no placeId needed)
<PlaceGalleryUploadTemp
  wizardSessionId={wizardSessionId}
  initialImages={localDraft.galleryUrls}
  onImagesChange={(mediaIds, urls) => {
    setLocalDraft(prev => ({
      ...prev,
      galleryMediaIds: mediaIds,
      galleryUrls: urls,
    }));
  }}
/>
```

### 4. Final Save (Creates Place)
```typescript
// "Save Draft" button
const saveDraft = async () => {
  const res = await fetch("/api/business/places", {
    method: "POST",
    body: JSON.stringify({
      createRequestId,
      status: "DRAFT",
      data: {
        ...localDraft,
        wizardSessionId, // ← Attach temp media
      },
    }),
  });
  
  const { place } = await res.json();
  
  // Clear wizard session
  await clearSession();
  
  // Navigate to edit page or places list
  router.push(`/business/places/${place.id}/edit`);
};

// "Submit for Moderation" button
const submitForModeration = async () => {
  const res = await fetch("/api/business/places", {
    method: "POST",
    body: JSON.stringify({
      createRequestId,
      status: "PENDING",
      data: {
        ...localDraft,
        wizardSessionId, // ← Attach temp media
      },
    }),
  });
  
  const { place } = await res.json();
  
  // Clear wizard session
  await clearSession();
  
  // Navigate to places list
  router.push("/business/places?status=PENDING");
};
```

### 5. Discard Wizard
```typescript
const handleDiscard = async () => {
  // Delete all temp media for session
  await fetch(`/api/business/temp-media/session/${wizardSessionId}`, {
    method: "DELETE",
  });
  
  // Clear localStorage
  await clearSession();
  
  // Navigate away
  router.push("/business/places");
};
```

## Components

### New Components
- `PlaceLogoUploadTemp` - Logo upload without placeId
- `PlaceGalleryUploadTemp` - Gallery upload without placeId
- `useWizardSession` - Hook for session management

### Updated Components
- `NewPlaceWizard` - Add wizardSessionId, remove auto-create logic
- `Step3Photos` - Use temp upload components
- POST `/api/business/places` - Attach temp media on creation

## State Management

### LocalDraft State
```typescript
interface LocalDraft {
  // Step 1
  title: string;
  category: string;
  shortDesc: string;
  description: string | null;
  ageTags: string[];
  visitFormats: string[];
  activityTypes: string[];
  
  // Step 2
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  formattedAddr: string | null;
  addressJson: any | null;
  // ... other location fields
  
  // Step 3 (NEW: track temp media)
  logoMediaId: string | null;
  logoUrl: string | null;
  galleryMediaIds: string[];
  galleryUrls: string[];
  
  // Step 4
  phone: string | null;
  website: string | null;
  instagramHandle: string | null;
  instagramUrl: string | null;
}
```

### localStorage Keys
```
wizard_session_place_{userId}
  → { sessionId: "uuid", timestamp: number }

wizard_session_place_{userId}_state
  → { state: LocalDraft, timestamp: number }
```

## Cleanup Strategy

### Immediate Cleanup
- On "Save Draft" / "Submit" → Mark temp media as ATTACHED
- On "Discard" → Mark temp media as DELETED

### Background Cleanup (Future)
```typescript
// Cron job or scheduled task
// Delete TEMP media older than 24 hours
// Delete DELETED media older than 7 days
// Delete orphaned files from CDN
```

## Benefits

1. **Zero DB pollution** - No draft Place records until user explicitly saves
2. **Immediate uploads** - No "save draft first" friction
3. **Reload-safe** - Uploads persist across page refresh via wizardSessionId
4. **Idempotent** - createRequestId prevents duplicate Place creation
5. **Clean UX** - Single "Save Draft" or "Submit" button creates everything
6. **Reusable** - Same pattern for Activities, Offers, Events

## Migration Path

### Phase 1: Implement (Current)
- ✅ Add TempMedia model
- ✅ Create temp media APIs
- ✅ Create temp upload components
- ✅ Update Place creation API
- ⏳ Update NewPlaceWizard to use temp media
- ⏳ Remove auto-create logic

### Phase 2: Test
- Test upload → save draft flow
- Test upload → submit flow
- Test upload → discard flow
- Test page reload recovery
- Test React StrictMode (no double uploads)

### Phase 3: Extend
- Apply same pattern to Activity wizard
- Apply same pattern to Offer wizard
- Implement background cleanup job

## Acceptance Criteria

- [ ] Opening wizard creates ZERO Place rows
- [ ] Logo upload works immediately without placeId
- [ ] Gallery upload works immediately without placeId
- [ ] Page refresh preserves uploaded images
- [ ] "Save Draft" creates Place + attaches images
- [ ] "Submit" creates Place + attaches images
- [ ] "Discard" deletes temp media + clears localStorage
- [ ] No duplicate Places (idempotency works)
- [ ] Images visible on Place card after save
- [ ] React StrictMode safe (no double uploads)
