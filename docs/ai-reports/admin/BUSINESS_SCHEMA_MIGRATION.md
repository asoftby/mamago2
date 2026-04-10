# Business Cabinet Schema Migration

## Migration Details

**Migration Name:** `20260302090635_add_business_cabinet_models`  
**Status:** ✅ Successfully Applied  
**Command:** `pnpm prisma migrate dev --name add_business_cabinet_models`

## Created Database Objects

### Enums

1. **OfferKind**
   - EVENT
   - SERVICE

2. **OfferStatus**
   - DRAFT
   - PENDING
   - PUBLISHED
   - REJECTED

### Tables

#### 1. Business
- **Primary Key:** id (TEXT)
- **Unique Constraint:** ownerUserId (one business per owner for MVP)
- **Foreign Keys:**
  - ownerUserId → User(id) ON DELETE CASCADE
- **Indexes:**
  - ownerUserId
- **Fields:**
  - id, name, ownerUserId, createdAt, updatedAt

#### 2. Place
- **Primary Key:** id (TEXT)
- **Foreign Keys:**
  - businessId → Business(id) ON DELETE CASCADE
  - cityId → City(id) ON DELETE RESTRICT
  - metroId → MetroStation(id) ON DELETE SET NULL (optional)
  - districtId → District(id) ON DELETE SET NULL (optional)
- **Indexes:**
  - businessId
  - cityId
- **Fields:**
  - id, businessId, title, address, cityId, lat, lng, metroId, districtId, phone, website, coverImage, createdAt, updatedAt

#### 3. Offer
- **Primary Key:** id (TEXT)
- **Foreign Keys:**
  - placeId → Place(id) ON DELETE CASCADE
- **Indexes:**
  - placeId
  - status
  - kind
  - dateFrom
  - (ageMinMonths, ageMaxMonths) - composite index
- **Fields:**
  - id, placeId, kind (OfferKind), title, description, coverImage
  - priceFrom (DOUBLE PRECISION), priceText
  - ageMinMonths (INTEGER), ageMaxMonths (INTEGER)
  - dateFrom (TIMESTAMP), dateTo (TIMESTAMP) - nullable, validation at app level
  - promoTitle, promoDescription, promoUntil
  - status (OfferStatus, default: DRAFT)
  - publishedAt, rejectionReason
  - createdAt, updatedAt

#### 4. Boost
- **Primary Key:** id (TEXT)
- **Foreign Keys:**
  - offerId → Offer(id) ON DELETE CASCADE
- **Indexes:**
  - offerId
  - (startAt, endAt) - composite index
- **Fields:**
  - id, offerId, startAt, endAt, createdAt

### Modified Tables (Reverse Relations Added)

#### City
- Added: `places Place[] @relation("PlaceCity")`

#### MetroStation
- Added: `places Place[] @relation("PlaceMetro")`

#### District
- Added: `places Place[] @relation("PlaceDistrict")`

#### User
- Added: `business Business?` (one business per owner for MVP)

## Key Design Decisions

### 1. One Business Per Owner (MVP)
- `Business.ownerUserId` is `@unique`
- Simplifies MVP implementation
- Can be relaxed in future versions

### 2. Age Range as Integers
- Changed from `ageTags String[]` to `ageMinMonths Int?` and `ageMaxMonths Int?`
- Easier filtering and indexing
- More precise age targeting

### 3. No Boost Type Field
- Removed `Boost.type` field
- Single rank boost for MVP
- Can add BoostType enum later if needed

### 4. Date Validation at Application Level
- `dateFrom` and `dateTo` are nullable at DB level
- SERVICE offers: must have null dates (enforced via Zod)
- EVENT offers: must have dateFrom (enforced via Zod)

### 5. Named Relations
- Used named relations (PlaceCity, PlaceMetro, PlaceDistrict)
- Prevents conflicts with existing relations
- Required by Prisma for multiple relations to same model

## Cascade Behavior

- **Business deleted** → All Places cascade delete
- **Place deleted** → All Offers cascade delete
- **Offer deleted** → All Boosts cascade delete
- **User deleted** → Business cascade deletes
- **City deleted** → Place deletion RESTRICTED (must handle manually)
- **MetroStation/District deleted** → Place foreign key SET NULL

## Next Steps

1. ✅ Schema migration complete
2. ⏭️ Implement middleware routing for business subdomain
3. ⏭️ Create server actions for Business/Place/Offer/Boost CRUD
4. ⏭️ Build Business Cabinet UI

## Verification

Run to verify tables were created:
```bash
pnpm prisma studio
```

Or query directly:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('Business', 'Place', 'Offer', 'Boost');
```
