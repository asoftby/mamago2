# Place Lifecycle Diagram

## 1. Initial Publication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUSINESS CABINET (Owner)                      │
└─────────────────────────────────────────────────────────────────┘

1. Create Place
   ↓
   POST /api/business/places
   {
     createRequestId: "...",
     status: "DRAFT" | "PENDING",
     data: { title, category, shortDesc, ... }
   }
   ↓
   Place created with status DRAFT or PENDING
   ↓
   If DRAFT:
   └─→ Owner can edit and save draft
       └─→ Owner submits → PENDING
   
   If PENDING:
   └─→ Goes directly to moderation queue

┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN MODERATION                              │
└─────────────────────────────────────────────────────────────────┘

2. Moderation Actions
   ↓
   POST /api/admin/moderation/places/[id]
   {
     action: "APPROVE" | "NEEDS_REVISION" | "REJECT",
     comment: "..."
   }
   ↓
   ├─ APPROVE
   │  └─→ PENDING → PUBLISHED
   │      └─→ Slug assigned
   │      └─→ Notification sent to owner
   │
   ├─ NEEDS_REVISION
   │  └─→ PENDING → NEEDS_REVISION
   │      └─→ Notification sent to owner
   │      └─→ Owner can edit and resubmit
   │
   └─ REJECT
      └─→ PENDING → REJECTED
          └─→ Notification sent to owner
          └─→ Owner can edit and resubmit

┌─────────────────────────────────────────────────────────────────┐
│                    PUBLISHED PLACE                               │
└─────────────────────────────────────────────────────────────────┘

3. Published Place (visible to users)
   ↓
   Status: PUBLISHED
   ├─ Can be used in Activities
   ├─ Can be used in Events
   ├─ Can be used in Offers
   └─ Can be edited via PlaceRevision
```

---

## 2. Post-Publication Edit Flow (PlaceRevision)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PUBLISHED PLACE                               │
│                    (Status: PUBLISHED)                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                    Owner wants to edit
                            ↓
        POST /api/business/places/[id]/revisions
                            ↓
        ┌─────────────────────────────────────────┐
        │  PlaceRevision created (Status: DRAFT)  │
        │  - Snapshot of current Place data       │
        │  - Owner can edit revision              │
        └─────────────────────────────────────────┘
                            ↓
                    Owner submits revision
                            ↓
        ┌─────────────────────────────────────────┐
        │  PlaceRevision (Status: PENDING)        │
        │  - Waiting for moderation               │
        │  - Place remains PUBLISHED              │
        └─────────────────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────────┐
        │        ADMIN MODERATION                 │
        │  POST /api/admin/moderation/revisions   │
        └─────────────────────────────────────────┘
                            ↓
        ├─ APPROVE
        │  └─→ PlaceRevision (Status: APPROVED)
        │      └─→ Merge changes into Place
        │      └─→ Place remains PUBLISHED
        │      └─→ Notification sent to owner
        │
        ├─ NEEDS_REVISION
        │  └─→ PlaceRevision (Status: NEEDS_REVISION)
        │      └─→ Owner can edit and resubmit
        │      └─→ Notification sent to owner
        │
        └─ REJECT
           └─→ PlaceRevision (Status: REJECTED)
               └─→ Changes discarded
               └─→ Place remains PUBLISHED
               └─→ Notification sent to owner
```

---

## 3. Ownership & Claim Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXISTING PLACE                                │
│                    Owner: User A                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                    User B wants to claim
                            ↓
        POST /api/business/places/[id]/claim
        {
          userId: "User B",
          businessId: "..." (optional)
        }
                            ↓
        ┌─────────────────────────────────────────┐
        │  PlaceClaimRequest created              │
        │  - Status: PENDING                      │
        │  - Waiting for admin review             │
        └─────────────────────────────────────────┘
                            ↓
        ┌─────────────────────────────────────────┐
        │        ADMIN REVIEW                     │
        │  POST /api/admin/places/claims/[id]    │
        └─────────────────────────────────────────┘
                            ↓
        ├─ APPROVE
        │  └─→ PlaceClaimRequest (Status: APPROVED)
        │      └─→ Place.ownerUserId = User B
        │      └─→ Notification sent to User B
        │      └─→ Notification sent to User A (previous owner)
        │
        └─ REJECT
           └─→ PlaceClaimRequest (Status: REJECTED)
               └─→ Place.ownerUserId remains User A
               └─→ Notification sent to User B
```

---

## 4. Complete Status Diagram

```
                    ┌─────────────┐
                    │   DRAFT     │
                    └──────┬──────┘
                           │
                    Owner submits
                           │
                           ↓
                    ┌─────────────┐
                    │  PENDING    │
                    └──────┬──────┘
                           │
                ┌──────────┼──────────┐
                │          │          │
           APPROVE    NEEDS_REV    REJECT
                │          │          │
                ↓          ↓          ↓
         ┌──────────┐ ┌──────────┐ ┌────────┐
         │PUBLISHED │ │NEEDS_REV │ │REJECTED│
         └────┬─────┘ └────┬─────┘ └────────┘
              │            │
              │      Owner resubmits
              │            │
              │            ↓
              │      ┌─────────────┐
              │      │  PENDING    │
              │      └──────┬──────┘
              │             │
              │      (cycle repeats)
              │
         Owner edits
         (PlaceRevision)
              │
              ↓
         ┌──────────────────┐
         │PlaceRevision     │
         │(DRAFT/PENDING)   │
         └──────────────────┘
              │
         Admin reviews
              │
         ┌────┴────┐
         │          │
      APPROVE   REJECT
         │          │
         ↓          ↓
      MERGE    DISCARD
         │
         ↓
    Place updated
    (remains PUBLISHED)
```

---

## 5. Access Control

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLACE OPERATIONS                              │
└─────────────────────────────────────────────────────────────────┘

Operation                  | Owner | Admin | Moderator | User
─────────────────────────────────────────────────────────────────
Create Place               |  ✅   |  ✅   |    ✅     |  ❌
Edit own Place (DRAFT)     |  ✅   |  ✅   |    ❌     |  ❌
Edit own Place (PUBLISHED) |  ✅   |  ✅   |    ❌     |  ❌
  (via PlaceRevision)      |       |       |           |
Submit for moderation      |  ✅   |  ✅   |    ❌     |  ❌
Moderate Place             |  ❌   |  ✅   |    ✅     |  ❌
Publish directly (admin)   |  ❌   |  ✅   |    ❌     |  ❌
Archive Place              |  ✅   |  ✅   |    ❌     |  ❌
Delete Place (hard)        |  ❌   |  ✅   |    ❌     |  ❌
Claim Place                |  ❌   |  ❌   |    ❌     |  ✅
Review Claim               |  ❌   |  ✅   |    ❌     |  ❌
```

---

## 6. Data Flow: Create → Publish

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. BUSINESS CABINET - Create Place                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  User fills form:                                                │
│  - Title, Category, Description                                  │
│  - Location (Google Places or Manual)                            │
│  - Images (Logo, Gallery)                                        │
│  - Contact info (Phone, Website, Instagram)                      │
│  - Tags (Age, Formats, Activity types)                           │
│                                                                   │
│  Clicks "Save Draft" or "Submit for Review"                      │
│                                                                   │
│  POST /api/business/places                                       │
│  {                                                               │
│    createRequestId: "unique-id",                                 │
│    status: "DRAFT" | "PENDING",                                  │
│    data: { ... }                                                 │
│  }                                                               │
│                                                                   │
│  Response:                                                       │
│  {                                                               │
│    place: {                                                      │
│      id: "place-123",                                            │
│      ownerUserId: "user-456",                                    │
│      status: "DRAFT" | "PENDING",                                │
│      title: "...",                                               │
│      ...                                                         │
│    }                                                             │
│  }                                                               │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. DATABASE - Place Created                                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Place {                                                         │
│    id: "place-123",                                              │
│    ownerUserId: "user-456",                                      │
│    status: "DRAFT" | "PENDING",                                  │
│    title: "Экопарк Акварель",                                    │
│    category: "park",                                             │
│    shortDesc: "Парк развлечений для детей",                      │
│    lat: 53.9045,                                                 │
│    lng: 27.5615,                                                 │
│    cityId: "city-1",                                             │
│    districtAutoId: "district-1",                                 │
│    metroAutoId: "metro-1",                                       │
│    logoImageId: "image-1",                                       │
│    createdAt: "2026-04-04T10:00:00Z",                            │
│    updatedAt: "2026-04-04T10:00:00Z"                             │
│  }                                                               │
│                                                                   │
│  PlaceImage[] {                                                  │
│    { id: "image-1", kind: "LOGO", url: "..." },                 │
│    { id: "image-2", kind: "GALLERY", url: "..." }               │
│  }                                                               │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. ADMIN MODERATION - Review Place                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Admin sees Place in moderation queue (status: PENDING)          │
│                                                                   │
│  Admin reviews and decides:                                      │
│  - APPROVE: Place looks good                                     │
│  - NEEDS_REVISION: Owner needs to fix something                  │
│  - REJECT: Place doesn't meet requirements                       │
│                                                                   │
│  POST /api/admin/moderation/places/place-123                     │
│  {                                                               │
│    action: "APPROVE",                                            │
│    comment: "Looks good!"                                        │
│  }                                                               │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. DATABASE - Place Published                                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Place {                                                         │
│    id: "place-123",                                              │
│    status: "PUBLISHED",  ← Changed from PENDING                  │
│    slug: "ekopark-akvareli",  ← Generated                        │
│    moderatedByUserId: "admin-789",  ← Set                        │
│    moderationReviewedAt: "2026-04-04T11:00:00Z",  ← Set          │
│    ...                                                           │
│  }                                                               │
│                                                                   │
│  ModerationLog {                                                 │
│    entityType: "PLACE",                                          │
│    entityId: "place-123",                                        │
│    action: "APPROVE",                                            │
│    message: "Looks good!",                                       │
│    reviewedByUserId: "admin-789",                                │
│    createdAt: "2026-04-04T11:00:00Z"                             │
│  }                                                               │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 5. NOTIFICATION - Owner Notified                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Notification {                                                  │
│    userId: "user-456",                                           │
│    type: "PLACE_APPROVED",                                       │
│    title: "Место опубликовано",                                  │
│    message: "Ваше место 'Экопарк Акварель' опубликовано",        │
│    entityType: "PLACE",                                          │
│    entityId: "place-123",                                        │
│    isRead: false,                                                │
│    createdAt: "2026-04-04T11:00:00Z"                             │
│  }                                                               │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│ 6. PUBLIC - Place Visible                                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Place is now visible in:                                        │
│  - Discovery (search, filters)                                   │
│  - Place details page                                            │
│  - Can be used in Activities                                     │
│  - Can be used in Events                                         │
│  - Can be used in Offers                                         │
│                                                                   │
│  URL: /places/ekopark-akvareli                                   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. Key Entities & Relations

```
User
├── id
├── email
├── role (USER, BUSINESS_OWNER, MODERATOR, ADMIN)
└── places (Place[]) ← ownerUserId

Place
├── id
├── ownerUserId → User
├── status (DRAFT, PENDING, PUBLISHED, NEEDS_REVISION, REJECTED, DELETED)
├── title
├── category
├── shortDesc
├── description
├── lat, lng
├── googlePlaceId
├── formattedAddr
├── cityId → City
├── districtAutoId → District
├── districtManualId → District
├── metroAutoId → MetroStation
├── metroManualId → MetroStation
├── moderatedByUserId → User
├── archivedByUserId → User
├── archivedAt
├── slug
├── images (PlaceImage[])
├── revisions (PlaceRevision[])
├── claimRequests (PlaceClaimRequest[])
└── activities (Activity[])

PlaceImage
├── id
├── placeId → Place
├── kind (LOGO, GALLERY)
├── url
├── sortOrder

PlaceRevision
├── id
├── placeId → Place
├── status (DRAFT, PENDING, NEEDS_REVISION, APPROVED, REJECTED)
├── [all editable Place fields as snapshot]
├── reviewedByUserId → User
├── images (PlaceRevisionImage[])

PlaceClaimRequest
├── id
├── placeId → Place
├── userId → User
├── businessId → Business
├── status (PENDING, APPROVED, REJECTED)
├── reviewedByUserId → User

ModerationLog
├── id
├── entityType (PLACE, ACTIVITY)
├── entityId
├── action (SUBMIT, APPROVE, NEEDS_REVISION, REJECT)
├── message
├── reviewedByUserId → User

Notification
├── id
├── userId → User
├── type (PLACE_APPROVED, PLACE_NEEDS_CHANGES, etc.)
├── title
├── message
├── entityType
├── entityId
├── isRead
```

