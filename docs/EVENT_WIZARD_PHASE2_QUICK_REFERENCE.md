# Event Wizard Phase 2 - Quick Reference

## API Endpoints

### Create Draft
```
POST /api/business/events
Body: EventPayload
Returns: { success: true, event: { id, title, status } }
```

### List Events
```
GET /api/business/events
Returns: { success: true, events: Activity[] }
```

### Get Event
```
GET /api/business/events/[id]
Returns: { success: true, event: Activity }
```

### Update Draft
```
PATCH /api/business/events/[id]
Body: EventPayload
Returns: { success: true, event: { id, title, status } }
```

### Submit for Moderation
```
POST /api/business/events/[id]/submit
Returns: { success: true, event: { id, title, status } }
```

## Form Data Type

```typescript
interface EventFormData {
  // Step 1: Basics (REQUIRED)
  title: string;
  activityType: "active" | "educational" | "calm" | null;
  categories: string[];
  age: string[];
  cinemaGenre?: string;
  cinemaDuration?: number;
  cinemaTrailerLink?: string;
  
  // Step 2: Description (REQUIRED)
  shortDescription: string; // 10-200 chars
  description: string; // min 20 chars
  
  // Step 3: Media (coverImage REQUIRED)
  coverImage: string | null;
  gallery: string[];
  videoLink?: string;
  
  // Step 4: DateTime (at least one date REQUIRED)
  dates: EventDate[];
  recurring: {
    enabled: boolean;
    frequency: "day" | "week" | "month" | "year" | null;
    until: string | null;
  };
  
  // Step 5: Price (isFree REQUIRED)
  isFree: boolean;
  price?: number;
  ticketLink?: string;
  
  // Step 6: Location (REQUIRED)
  locationMode: "existing" | "manual";
  placeId?: string;
  manualLocation?: {
    venueName: string;
    address: string;
    city: string;
  };
  
  // Step 7: Contacts (OPTIONAL)
  phone?: string;
  website?: string;
  socialNetworks: SocialNetwork[];
  
  // Step 8: Organizer (organizerName REQUIRED)
  organizerName: string;
  organizerDescription?: string;
  organizerId?: string;
}

interface EventDate {
  id: string;
  date: string; // YYYY-MM-DD
  allDay: boolean;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
}

interface SocialNetwork {
  id: string;
  type: "instagram" | "telegram" | "tiktok" | "youtube" | "other";
  link: string;
}
```

## Submit-Required Fields

```typescript
const REQUIRED_FIELDS = {
  step1: ["title", "activityType", "categories", "age"],
  step2: ["shortDescription", "description"],
  step3: ["coverImage"],
  step4: ["dates"], // at least one
  step5: ["isFree"],
  step6: ["locationMode"], // + location data
  step8: ["organizerName"],
};
```

## Validation Functions

```typescript
// Validate specific step
validateStep(step: number, data: EventFormData): ValidationResult

// Validate for submit
validateForSubmit(data: EventFormData): ValidationResult

interface ValidationResult {
  isValid: boolean;
  isComplete: boolean;
  errors: string[];
  warnings: string[];
}
```

## Mapper Functions

```typescript
// Activity → EventFormData (for edit mode)
mapEventToFormData(event: Activity): EventFormData

// EventFormData → Activity payload (for API)
buildEventPayload(data: EventFormData): ActivityPayload

// Detect changes for PATCH
extractChanges(current: EventFormData, original: EventFormData): Partial<ActivityPayload>

// EventDate → ActivitySession
buildSessionPayload(eventDate: EventDate, activityId: string): SessionPayload
```

## Activity Payload Structure

```typescript
{
  type: "EVENT",
  status: "DRAFT" | "PENDING_REVIEW",
  
  title: string,
  shortDesc: string,
  description: string,
  ageTags: string[],
  
  scheduleMode: "SPECIFIC_DATES",
  scheduleJson: {
    dates: EventDate[],
    recurring: { enabled, frequency, until },
    videoLink: string,
    ticketLink: string,
    contacts: { phone, website, socialNetworks },
    organizer: { name, description },
  },
  
  priceFrom: number | null,
  priceTo: number | null,
  priceText: string | null,
  currency: "BYN",
  
  coverImageId: string | null,
  placeId: string | null,
  businessId: string | null,
  ownerUserId: string,
}
```

## Implemented Steps

### ✅ Step 1: Basics
- Title input
- Activity type selector (3 options)
- Categories checkboxes (7 options)
- Age checkboxes (5 ranges)
- Cinema fields (conditional)

### ✅ Step 2: Description
- Short description textarea (200 char limit)
- Full description textarea
- Character counters

### ⏳ Step 3: Media
- Placeholder (needs ImageUploader)

### ✅ Step 4: DateTime
- Date list with add/remove
- Date picker
- All day toggle
- Time pickers
- Recurring settings

### ⏳ Step 5: Price
- Placeholder (needs form fields)

### ✅ Step 6: Location
- Mode selector (existing/manual)
- Place ID input (TODO: search)
- Manual location fields

### ⏳ Step 7: Contacts
- Placeholder (needs form fields)

### ⏳ Step 8: Organizer
- Placeholder (needs form fields)

### ⏳ Step 9: Review
- Placeholder (needs summary)

## Usage Example

```typescript
// Create mode
<EventWizard
  mode="create"
  userId={user.id}
  onComplete={(eventId) => router.push(`/business/events/${eventId}`)}
/>

// Edit mode
<EventWizard
  mode="edit"
  event={existingEvent}
  userId={user.id}
  onComplete={(eventId) => router.push(`/business/events/${eventId}`)}
/>
```

## Routes

```
/business/events/new → Create new event
/business/events/[id]/edit → Edit existing event
/business/events → List all events
```

## Next Steps

1. Complete Step 3 (Media) - ImageUploader integration
2. Complete Step 5 (Price) - form fields
3. Complete Step 7 (Contacts) - form fields
4. Complete Step 8 (Organizer) - form fields
5. Complete Step 9 (Review) - summary display
6. Implement ActivitySession creation
7. Implement ActivityImage management
8. Add place search in Step 6
9. Implement recurring events logic
