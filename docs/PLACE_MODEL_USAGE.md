# Place Model - Usage Guide

## Quick Reference

### Enums

```typescript
import { ContentStatus, LocationSource, PlaceImageKind } from "@prisma/client";

// ContentStatus
ContentStatus.DRAFT          // Черновик
ContentStatus.PENDING        // На модерации
ContentStatus.PUBLISHED      // Опубликовано
ContentStatus.NEEDS_CHANGES  // Требует изменений
ContentStatus.REJECTED       // Отклонено

// LocationSource
LocationSource.GOOGLE   // Из Google Places API
LocationSource.MANUAL   // Введено вручную

// PlaceImageKind
PlaceImageKind.LOGO     // Логотип
PlaceImageKind.GALLERY  // Галерея
```

## Creating a Place

### Minimal Place (DRAFT)

```typescript
const place = await prisma.place.create({
  data: {
    ownerUserId: user.id,
    title: "My Cafe",
    category: "cafe",
    shortDesc: "A cozy cafe in the city center",
    status: ContentStatus.DRAFT,
  },
});
```

### Place with Google Location

```typescript
const place = await prisma.place.create({
  data: {
    ownerUserId: user.id,
    title: "Central Museum",
    category: "museum",
    shortDesc: "Historical museum",
    locationSource: LocationSource.GOOGLE,
    googlePlaceId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
    lat: 53.9006,
    lng: 27.5590,
    formattedAddr: "пр. Независимости 25, Минск",
    addressJson: {
      street: "пр. Независимости",
      house: "25",
      city: "Минск",
      country: "Belarus",
    },
    countryCode: "BY",
    cityId: minskCityId,
  },
});
```

### Place with Manual Location

```typescript
const place = await prisma.place.create({
  data: {
    ownerUserId: user.id,
    title: "Kids Playground",
    category: "park",
    shortDesc: "Outdoor playground for kids",
    locationSource: LocationSource.MANUAL,
    customAddress: "ул. Ленина 10, Минск",
    cityId: minskCityId,
  },
});
```

## Adding Images

### Logo Image

```typescript
// 1. Create logo image
const logoImage = await prisma.placeImage.create({
  data: {
    placeId: place.id,
    kind: PlaceImageKind.LOGO,
    url: "https://cdn.example.com/logos/cafe-logo.jpg",
    width: 400,
    height: 400,
    blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
    sortOrder: 0,
  },
});

// 2. Link logo to place
await prisma.place.update({
  where: { id: place.id },
  data: { logoImageId: logoImage.id },
});
```

### Gallery Images

```typescript
const galleryImages = await prisma.placeImage.createMany({
  data: [
    {
      placeId: place.id,
      kind: PlaceImageKind.GALLERY,
      url: "https://cdn.example.com/gallery/1.jpg",
      width: 1920,
      height: 1080,
      sortOrder: 1,
    },
    {
      placeId: place.id,
      kind: PlaceImageKind.GALLERY,
      url: "https://cdn.example.com/gallery/2.jpg",
      width: 1920,
      height: 1080,
      sortOrder: 2,
    },
  ],
});
```

## Querying Places

### Get Place with Images

```typescript
const place = await prisma.place.findUnique({
  where: { id: placeId },
  include: {
    images: {
      orderBy: { sortOrder: "asc" },
    },
    owner: {
      select: { email: true, role: true },
    },
    city: true,
  },
});

// Get logo
const logo = place.images.find((img) => img.kind === PlaceImageKind.LOGO);

// Get gallery
const gallery = place.images.filter(
  (img) => img.kind === PlaceImageKind.GALLERY
);
```

### Filter by Status

```typescript
const publishedPlaces = await prisma.place.findMany({
  where: {
    status: ContentStatus.PUBLISHED,
  },
  include: {
    images: {
      where: { kind: PlaceImageKind.LOGO },
    },
  },
});
```

### Filter by Category

```typescript
const cafes = await prisma.place.findMany({
  where: {
    category: "cafe",
    status: ContentStatus.PUBLISHED,
  },
});
```

### Filter by Tags

```typescript
// Places for age 3-7
const placesForKids = await prisma.place.findMany({
  where: {
    ageTags: {
      hasSome: ["3-7"],
    },
  },
});

// Indoor places
const indoorPlaces = await prisma.place.findMany({
  where: {
    visitFormats: {
      has: "indoor",
    },
  },
});

// Sports activities
const sportsPlaces = await prisma.place.findMany({
  where: {
    activityTypes: {
      hasSome: ["sports"],
    },
  },
});
```

### Filter by Owner

```typescript
const myPlaces = await prisma.place.findMany({
  where: {
    ownerUserId: userId,
  },
  orderBy: {
    createdAt: "desc",
  },
});
```

## Updating Places

### Update Basic Info

```typescript
await prisma.place.update({
  where: { id: placeId },
  data: {
    title: "Updated Title",
    shortDesc: "Updated description",
    description: "Full SEO description",
  },
});
```

### Update Status

```typescript
// Submit for moderation
await prisma.place.update({
  where: { id: placeId },
  data: {
    status: ContentStatus.PENDING,
  },
});

// Publish
await prisma.place.update({
  where: { id: placeId },
  data: {
    status: ContentStatus.PUBLISHED,
  },
});
```

### Update Tags

```typescript
await prisma.place.update({
  where: { id: placeId },
  data: {
    ageTags: ["0-3", "3-7", "7-12"],
    visitFormats: ["indoor", "outdoor"],
    activityTypes: ["sports", "education"],
  },
});
```

### Update Contact Info

```typescript
await prisma.place.update({
  where: { id: placeId },
  data: {
    phone: "+375291234567",
    website: "https://example.com",
    instagramHandle: "myplace",
    instagramUrl: "https://instagram.com/myplace",
  },
});
```

## Validation Rules

### Required for DRAFT
- `ownerUserId`
- `title`
- `category`
- `shortDesc`

### Required for PUBLISHED
- All DRAFT fields
- `logoImageId` (must reference existing PlaceImage with kind=LOGO)
- Location: either `googlePlaceId` OR `customAddress`

### Business Logic
```typescript
async function canPublish(placeId: string): Promise<boolean> {
  const place = await prisma.place.findUnique({
    where: { id: placeId },
    include: {
      images: {
        where: { kind: PlaceImageKind.LOGO },
      },
    },
  });

  if (!place) return false;

  // Check required fields
  if (!place.title || !place.category || !place.shortDesc) {
    return false;
  }

  // Check logo
  if (!place.logoImageId || place.images.length === 0) {
    return false;
  }

  // Check location
  if (!place.googlePlaceId && !place.customAddress) {
    return false;
  }

  return true;
}
```

## Common Patterns

### Get Place with Logo URL

```typescript
const place = await prisma.place.findUnique({
  where: { id: placeId },
  include: {
    images: {
      where: { kind: PlaceImageKind.LOGO },
      take: 1,
    },
  },
});

const logoUrl = place.images[0]?.url;
```

### Get Places for Map

```typescript
const placesForMap = await prisma.place.findMany({
  where: {
    status: ContentStatus.PUBLISHED,
    lat: { not: null },
    lng: { not: null },
  },
  select: {
    id: true,
    title: true,
    category: true,
    lat: true,
    lng: true,
    images: {
      where: { kind: PlaceImageKind.LOGO },
      select: { url: true },
      take: 1,
    },
  },
});
```

### Search Places

```typescript
const searchResults = await prisma.place.findMany({
  where: {
    status: ContentStatus.PUBLISHED,
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { shortDesc: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ],
  },
  include: {
    images: {
      where: { kind: PlaceImageKind.LOGO },
      take: 1,
    },
  },
  take: 20,
});
```

## Best Practices

1. **Always include logo** when displaying Place cards
2. **Use sortOrder** for gallery images
3. **Validate logoImageId** before publishing
4. **Use transactions** when creating Place + Images together
5. **Index queries** by status, category, ownerUserId
6. **Cache published places** for better performance
7. **Lazy load** gallery images
8. **Use blurhash** for image placeholders

## Example: Complete Place Creation Flow

```typescript
async function createPlaceWithImages(
  userId: string,
  data: {
    title: string;
    category: string;
    shortDesc: string;
    logoUrl: string;
    galleryUrls: string[];
  }
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Create place
    const place = await tx.place.create({
      data: {
        ownerUserId: userId,
        title: data.title,
        category: data.category,
        shortDesc: data.shortDesc,
        status: ContentStatus.DRAFT,
      },
    });

    // 2. Create logo image
    const logoImage = await tx.placeImage.create({
      data: {
        placeId: place.id,
        kind: PlaceImageKind.LOGO,
        url: data.logoUrl,
        sortOrder: 0,
      },
    });

    // 3. Link logo to place
    await tx.place.update({
      where: { id: place.id },
      data: { logoImageId: logoImage.id },
    });

    // 4. Create gallery images
    if (data.galleryUrls.length > 0) {
      await tx.placeImage.createMany({
        data: data.galleryUrls.map((url, index) => ({
          placeId: place.id,
          kind: PlaceImageKind.GALLERY,
          url,
          sortOrder: index + 1,
        })),
      });
    }

    // 5. Return place with images
    return await tx.place.findUnique({
      where: { id: place.id },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  });
}
```


## Place Hierarchy (Complex → Units)

### Creating a Complex (Shopping Mall)

```typescript
import { PlaceKind, ContentStatus, LocationSource } from "@prisma/client";

const mall = await prisma.place.create({
  data: {
    ownerUserId: userId,
    title: "Dana Mall",
    category: "shopping-mall",
    shortDesc: "Торговый центр Dana Mall",
    description: "Крупный торговый центр в центре Минска",
    placeKind: PlaceKind.COMPLEX,
    locationSource: LocationSource.GOOGLE,
    googlePlaceId: "ChIJ_dana_mall_id",
    lat: 53.9006,
    lng: 27.559,
    formattedAddr: "ул. Петра Мстиславца 11, Минск",
    countryCode: "BY",
    status: ContentStatus.PUBLISHED,
  },
});
```

### Creating a Unit Inside Complex

```typescript
import { createUnitInComplex } from "@/lib/place/hierarchy";

const cafe = await createUnitInComplex(userId, mall.id, {
  title: "Coffee House",
  category: "cafe",
  shortDesc: "Кофейня в Dana Mall",
  floor: "2",
  unit: "A12",
  phone: "+375291234567",
  website: "https://coffeehouse.by",
});

// Result:
// {
//   placeKind: "UNIT",
//   parentPlaceId: mall.id,
//   unitLabel: "2 этаж, павильон A12",
//   lat: 53.9006,  // Inherited from parent
//   lng: 27.559,   // Inherited from parent
// }
```

### Checking for Duplicates

```typescript
import { checkDuplicatePlace } from "@/lib/place/hierarchy";

const result = await checkDuplicatePlace(googlePlaceId);

if (result.action === "CREATE_UNIT") {
  // Show UI: "This is inside a complex"
  console.log(`Complex: ${result.complexTitle}`);
  console.log(`Address: ${result.complexAddress}`);
  // Prompt user to create UNIT
}

if (result.action === "USE_EXISTING") {
  // Show UI: "This place already exists"
  console.log(`Place: ${result.placeTitle}`);
  // Suggest creating Activity instead
}

if (result.action === "CREATE_NEW") {
  // Create new STANDALONE place
}
```

### Getting Complex with Units

```typescript
import { getComplexWithUnits } from "@/lib/place/hierarchy";

const mall = await getComplexWithUnits(mallId);

console.log(`Complex: ${mall.title}`);
console.log(`Units: ${mall.children.length}`);

mall.children.forEach((unit) => {
  console.log(`- ${unit.title} (${unit.unitLabel})`);
});
```

### Getting Unit with Parent

```typescript
import { getUnitWithParent } from "@/lib/place/hierarchy";

const unit = await getUnitWithParent(unitId);

console.log(`Unit: ${unit.title}`);
console.log(`Location: ${unit.unitLabel}`);
console.log(`Complex: ${unit.parentPlace?.title}`);
console.log(`Address: ${unit.parentPlace?.formattedAddr}`);
```

### Getting Place Coordinates

```typescript
import { getPlaceCoordinates } from "@/lib/place/hierarchy";

// For UNIT, returns parent's coordinates
// For COMPLEX/STANDALONE, returns own coordinates
const coords = await getPlaceCoordinates(placeId);

if (coords.lat && coords.lng) {
  console.log(`Location: ${coords.lat}, ${coords.lng}`);
}
```

### Querying by PlaceKind

```typescript
// Get all complexes
const complexes = await prisma.place.findMany({
  where: {
    placeKind: PlaceKind.COMPLEX,
    status: ContentStatus.PUBLISHED,
  },
});

// Get all units in a city
const units = await prisma.place.findMany({
  where: {
    placeKind: PlaceKind.UNIT,
    cityId: "minsk",
    status: ContentStatus.PUBLISHED,
  },
  include: {
    parentPlace: {
      select: { title: true, formattedAddr: true },
    },
  },
});

// Get standalone places only
const standalones = await prisma.place.findMany({
  where: {
    placeKind: PlaceKind.STANDALONE,
    status: ContentStatus.PUBLISHED,
  },
});
```

### Helper Functions

```typescript
import {
  isComplex,
  isUnit,
  isStandalone,
  validateUnitData,
  generateUnitLabel,
  canCreateUnitInComplex,
} from "@/lib/place/hierarchy";

// Check place type
if (isComplex(place)) {
  console.log("This is a complex");
}

if (isUnit(place)) {
  console.log("This is a unit inside a complex");
}

// Validate unit data
const validation = validateUnitData({
  floor: "2",
  unit: "A12",
  parentPlaceId: mallId,
});

if (!validation.valid) {
  console.error("Validation errors:", validation.errors);
}

// Generate unit label
const label = generateUnitLabel("2", "A12");
// Result: "2 этаж, павильон A12"

// Check if can create unit
const canCreate = await canCreateUnitInComplex(mallId);
if (!canCreate) {
  throw new Error("Complex must be published to create units");
}
```

### UI Example: Complex Page

```tsx
import { getComplexWithUnits } from "@/lib/place/hierarchy";

export default async function ComplexPage({ params }: { params: { id: string } }) {
  const complex = await getComplexWithUnits(params.id);

  if (!complex) {
    notFound();
  }

  return (
    <div>
      <h1>{complex.title}</h1>
      <p>{complex.description}</p>

      {/* Map */}
      <Map center={{ lat: complex.lat, lng: complex.lng }} />

      {/* Units inside */}
      {complex.children.length > 0 && (
        <section>
          <h2>Места внутри</h2>
          <div className="grid grid-cols-3 gap-4">
            {complex.children.map((unit) => (
              <UnitCard
                key={unit.id}
                unit={unit}
                showFloor
                showUnit
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

### UI Example: Create Unit Form

```tsx
"use client";

import { useState } from "react";
import { createUnitInComplex } from "@/lib/place/hierarchy";

export function CreateUnitForm({ complexId }: { complexId: string }) {
  const [floor, setFloor] = useState("");
  const [unit, setUnit] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newUnit = await createUnitInComplex(userId, complexId, {
      title: "My Shop",
      category: "shop",
      shortDesc: "My shop in the mall",
      floor,
      unit,
    });

    console.log("Created unit:", newUnit.id);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Этаж"
        value={floor}
        onChange={(e) => setFloor(e.target.value)}
      />
      <input
        type="text"
        placeholder="Павильон"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
      />
      <p>Обозначение: {floor && unit ? `${floor} этаж, павильон ${unit}` : ""}</p>
      <button type="submit">Создать</button>
    </form>
  );
}
```

## Best Practices for Hierarchy

1. **Always check for duplicates** before creating a place
2. **Use COMPLEX for large venues** (malls, parks, stadiums)
3. **Use UNIT for shops/cafes inside** complexes
4. **Inherit coordinates** from parent for units
5. **Validate unit data** before creation (floor, unit required)
6. **Show parent info** on unit pages
7. **List units** on complex pages
8. **Use null googlePlaceId** for units
9. **Restrict deletion** of complexes with units (onDelete: Restrict)
10. **Order units** by floor and unit number
