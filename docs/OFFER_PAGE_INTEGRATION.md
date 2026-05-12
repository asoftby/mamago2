# Offer Page Integration Guide

Руководство по интеграции публичной страницы предложения с базой данных и API.

## Архитектура данных

### Database Schema

Offer Page использует существующую модель `Activity` с `type = "OFFER"`:

```prisma
model Activity {
  id                   String                    @id @default(cuid())
  type                 ActivityType              // "OFFER"
  title                String
  shortDesc            String
  description          String?                   // Rich HTML
  coverImageUrl        String?
  placeId              String?
  businessId           String?
  status               ContentStatus             @default(DRAFT)
  
  // Offer-specific fields
  offerType            String?                   // "SINGLE" | "REGULAR" | "CAMP"
  priceFrom            Float?
  priceTo              Float?
  priceText            String?
  priceDetails         String?                   // Rich HTML
  
  // Relations
  place                Place?                    @relation(fields: [placeId], references: [id])
  business             Business?                 @relation(fields: [businessId], references: [id])
  images               ActivityImage[]
  sessions             ActivitySession[]
  filterOptions        ActivityFilterOption[]
  
  // Discovery signals
  discoverySignalIds   String[]                  @default([])
  
  // Metadata
  ageMinMonths         Int?
  ageMaxMonths         Int?
  scheduleJson         Json?                     // Расписание/смены
  
  // SEO
  slug                 String?                   @unique
  seoTitle             String?
  seoDescription       String?
  seoOgImage           String?
}
```

### Extended Fields (JSON)

Некоторые данные хранятся в JSON полях для гибкости:

#### `scheduleJson` (для REGULAR и CAMP)

```json
{
  "type": "classes" | "shifts",
  "items": [
    {
      "id": "string",
      "groupName": "string",      // для classes
      "days": "string",            // для classes
      "time": "string",            // для classes
      "title": "string",           // для shifts
      "dateFrom": "string",        // для shifts
      "dateTo": "string",          // для shifts
      "duration": "string",
      "ageRange": "string",
      "spotsLeft": number,
      "capacity": number,
      "price": "string",
      "ctaEnabled": boolean
    }
  ]
}
```

#### `accommodationJson` (для CAMP)

```json
{
  "provided": boolean,
  "type": "string",
  "address": "string",
  "rooms": "string",
  "conditions": "string",
  "meals": ["breakfast", "lunch", "dinner"],
  "mealInfo": "string",
  "transferInfo": "string",
  "whatToBring": "string",
  "safetyInfo": "string",
  "medicalInfo": "string"
}
```

## API Implementation

### 1. Data Fetching Function

Создайте функцию для получения данных из БД:

```typescript
// src/lib/offer/offerPageData.ts

import { prisma } from "@/lib/prisma";
import type { OfferPageData } from "./offerPageTypes";
import { notFound } from "next/navigation";

export async function getOfferPageData(
  slug: string,
  citySlug: string
): Promise<OfferPageData> {
  const activity = await prisma.activity.findFirst({
    where: {
      slug,
      type: "OFFER",
      status: "PUBLISHED",
      // Optional: filter by city
    },
    include: {
      place: {
        include: {
          districtManual: true,
          metroManual: true,
        },
      },
      business: true,
      images: {
        orderBy: { sortOrder: "asc" },
      },
      coverImage: true,
    },
  });

  if (!activity) {
    notFound();
  }

  // Transform database model to OfferPageData
  return transformActivityToOfferPageData(activity);
}

function transformActivityToOfferPageData(activity: any): OfferPageData {
  // Parse JSON fields
  const scheduleData = activity.scheduleJson 
    ? JSON.parse(activity.scheduleJson) 
    : null;
  
  const accommodationData = activity.accommodationJson
    ? JSON.parse(activity.accommodationJson)
    : null;

  return {
    id: activity.id,
    slug: activity.slug,
    citySlug: "minsk", // TODO: get from activity or place
    title: activity.title,
    shortDescription: activity.shortDesc,
    description: activity.description || "",
    offerType: activity.offerType || "SINGLE",
    
    media: {
      posterUrl: activity.coverImageUrl || "/placeholder.jpg",
      posterAlt: activity.title,
      gallery: activity.images.map((img: any) => ({
        id: img.id,
        url: img.url,
        width: img.width,
        height: img.height,
        blurhash: img.blurhash,
        alt: activity.title,
      })),
      videoUrl: activity.videoUrl,
      videoThumbnail: activity.videoThumbnail,
      videoDuration: activity.videoDuration,
      videoLabel: activity.videoLabel,
    },
    
    metaGrid: buildMetaGrid(activity),
    
    pricing: {
      mode: activity.pricingMode || "single",
      singlePrice: activity.priceText,
      priceFrom: activity.priceFrom ? `${activity.priceFrom} BYN` : undefined,
      priceCaption: activity.priceCaption,
      options: activity.pricingOptions ? JSON.parse(activity.pricingOptions) : [],
      promotionText: activity.promotionText,
    },
    
    schedule: scheduleData,
    accommodation: accommodationData,
    
    place: activity.place ? {
      id: activity.place.id,
      name: activity.place.name,
      slug: activity.place.slug,
      address: activity.place.address,
      district: activity.place.districtManual?.name,
      metro: activity.place.metroManual?.name,
      lat: activity.place.lat,
      lng: activity.place.lng,
    } : undefined,
    
    reviews: [], // TODO: fetch reviews
    reviewsCount: 0,
    averageRating: undefined,
    
    cta: {
      type: activity.ctaType || "записаться",
      primaryLabel: activity.ctaPrimaryLabel || "Записаться",
      secondaryLabel: "В план",
      phone: activity.ctaPhone,
      link: activity.ctaLink,
      instructions: activity.ctaInstructions,
    },
    
    similar: [], // TODO: fetch similar offers
    
    seo: {
      title: activity.seoTitle,
      description: activity.seoDescription,
      ogTitle: activity.seoOgTitle,
      ogDescription: activity.seoOgDescription,
      ogImage: activity.seoOgImage,
      canonicalUrl: activity.seoCanonicalUrl,
    },
    
    previewBannerLabel: activity.status === "DRAFT" 
      ? "Черновик — видно только вам" 
      : undefined,
    
    discoveryIntent: {
      source: "discovery",
      category: activity.eventCategoryId,
      signal: activity.discoverySignalIds[0],
    },
  };
}

function buildMetaGrid(activity: any): OfferMetaItem[] {
  const items: OfferMetaItem[] = [];
  
  // Age
  if (activity.ageMinMonths || activity.ageMaxMonths) {
    items.push({
      id: "age",
      icon: "age",
      label: "Возраст",
      value: formatAgeRange(activity.ageMinMonths, activity.ageMaxMonths),
    });
  }
  
  // Duration
  if (activity.duration) {
    items.push({
      id: "duration",
      icon: "duration",
      label: "Длительность",
      value: activity.duration,
    });
  }
  
  // Format
  if (activity.format) {
    items.push({
      id: "format",
      icon: "format",
      label: "Формат",
      value: activity.format === "OFFLINE" ? "Офлайн" : "Онлайн",
    });
  }
  
  // Add more meta items based on offer type
  
  return items;
}
```

### 2. Update Page Component

```typescript
// src/app/(public)/[city]/offers/[slug]/page.tsx

import { getOfferPageData } from "@/lib/offer/offerPageData";
import { OfferPageView } from "@/components/offers";

export default async function OfferPage({ params }: OfferPageProps) {
  const data = await getOfferPageData(params.slug, params.city);
  return <OfferPageView data={data} />;
}
```

## Reviews Integration

### Fetch Reviews

```typescript
async function getOfferReviews(activityId: string): Promise<OfferReview[]> {
  const reviews = await prisma.review.findMany({
    where: {
      activityId,
      status: "APPROVED",
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      author: {
        select: {
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return reviews.map((review) => ({
    id: review.id,
    authorName: review.author?.displayName || "Аноним",
    authorAvatar: review.author?.avatarUrl,
    rating: review.rating,
    text: review.text,
    date: formatDate(review.createdAt),
    helpful: review.helpfulCount,
  }));
}
```

## Similar Offers

### Recommendation Algorithm

```typescript
async function getSimilarOffers(
  activityId: string,
  limit: number = 4
): Promise<OfferSimilarItem[]> {
  const currentActivity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      eventCategoryId: true,
      discoverySignalIds: true,
      ageMinMonths: true,
      ageMaxMonths: true,
    },
  });

  if (!currentActivity) return [];

  // Find similar by category and signals
  const similar = await prisma.activity.findMany({
    where: {
      type: "OFFER",
      status: "PUBLISHED",
      id: { not: activityId },
      OR: [
        { eventCategoryId: currentActivity.eventCategoryId },
        { 
          discoverySignalIds: {
            hasSome: currentActivity.discoverySignalIds,
          },
        },
      ],
    },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      place: true,
    },
  });

  return similar.map((activity) => ({
    id: activity.id,
    title: activity.title,
    slug: activity.slug,
    coverUrl: activity.coverImageUrl || "/placeholder.jpg",
    priceLabel: activity.priceText,
    ageLabel: formatAgeRange(activity.ageMinMonths, activity.ageMaxMonths),
    placeTitle: activity.place?.name,
    rating: activity.averageRating,
    reviewsCount: activity.reviewsCount,
  }));
}
```

## CTA Actions Integration

### Save to Plan

```typescript
// Already implemented in existing codebase
// Use: /api/save/plan endpoint
```

### Booking Flow

```typescript
// TODO: Implement booking flow
// POST /api/bookings/request
// Body: { activityId, sessionId?, date?, phone, name, message }
```

### External Link

```typescript
// If cta.type === "перейти_на_сайт"
// Redirect to cta.link with analytics tracking
```

## SEO & Schema.org

### Generate JSON-LD

```typescript
function generateOfferSchema(data: OfferPageData) {
  return {
    "@context": "https://schema.org",
    "@type": "Offer",
    "name": data.title,
    "description": data.shortDescription,
    "image": data.media.posterUrl,
    "url": `https://mamago.by/${data.citySlug}/offers/${data.slug}`,
    "price": data.pricing.priceFrom || data.pricing.singlePrice,
    "priceCurrency": "BYN",
    "availability": "https://schema.org/InStock",
    "seller": {
      "@type": "Organization",
      "name": data.place?.name || "mamaGo",
    },
    "aggregateRating": data.averageRating ? {
      "@type": "AggregateRating",
      "ratingValue": data.averageRating,
      "reviewCount": data.reviewsCount,
    } : undefined,
  };
}
```

## Performance Optimization

### Caching Strategy

```typescript
// Use Next.js ISR (Incremental Static Regeneration)
export const revalidate = 3600; // 1 hour

// Or use React Cache
import { cache } from "react";

export const getOfferPageData = cache(async (slug: string, citySlug: string) => {
  // ... fetch logic
});
```

### Image Optimization

```typescript
// Use next/image with proper sizes
<Image
  src={data.media.posterUrl}
  alt={data.media.posterAlt}
  fill
  priority
  sizes="(max-width: 1024px) 100vw, 60vw"
/>
```

## Testing

### Unit Tests

```typescript
// src/lib/offer/__tests__/offerPageData.test.ts

describe("getOfferPageData", () => {
  it("should fetch and transform offer data", async () => {
    const data = await getOfferPageData("test-slug", "minsk");
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("title");
    expect(data.offerType).toBeOneOf(["SINGLE", "REGULAR", "CAMP"]);
  });
});
```

### E2E Tests

```typescript
// cypress/e2e/offer-page.cy.ts

describe("Offer Page", () => {
  it("should display offer details", () => {
    cy.visit("/minsk/offers/robotics-for-kids");
    cy.contains("Робототехника для детей");
    cy.get("[data-testid=offer-hero]").should("be.visible");
    cy.get("[data-testid=offer-cta]").should("be.visible");
  });
});
```

## Migration Checklist

- [ ] Add `offerType` field to Activity model
- [ ] Add `scheduleJson` field to Activity model
- [ ] Add `accommodationJson` field to Activity model
- [ ] Add `videoUrl`, `videoThumbnail`, `videoDuration` fields
- [ ] Create `getOfferPageData` function
- [ ] Implement reviews fetching
- [ ] Implement similar offers algorithm
- [ ] Add booking flow API endpoints
- [ ] Generate SEO metadata
- [ ] Add analytics tracking
- [ ] Test on staging
- [ ] Deploy to production

## Next Steps

1. **Database Migration**: Add new fields to Activity model
2. **API Implementation**: Create data fetching functions
3. **Reviews System**: Integrate with existing reviews
4. **Booking Flow**: Implement booking request system
5. **Analytics**: Add tracking events
6. **Testing**: Write unit and E2E tests
7. **Documentation**: Update API docs

## Support

- **Technical Questions**: Slack #dev-offer-page
- **Design Questions**: Figma comments
- **Bug Reports**: GitHub Issues
