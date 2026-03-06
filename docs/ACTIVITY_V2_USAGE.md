# Activity V2 Usage Guide

## Quick Start

### Creating an Activity

```typescript
// 1. Create draft activity
POST /api/business/activities-v2
{
  "type": "EVENT",        // EVENT | PERMANENT | COURSE | ROUTE | OFFER
  "placeId": "place-id"   // Required (except for ROUTE)
}

// 2. Update activity fields (autosave)
PATCH /api/business/activities-v2/[id]
{
  "title": "Summer Camp",
  "shortDesc": "Fun activities for kids",
  "scheduleMode": "MULTI_DATE",
  "ageTags": ["7-12"],
  "priceFrom": 50,
  "coverImageId": "image-id"
}

// 3. Submit for moderation
POST /api/business/activities-v2/[id]/submit
// Returns validation errors or success
```

## Activity Types

### EVENT - Разовое мероприятие
```typescript
{
  type: "EVENT",
  scheduleMode: "ONE_TIME" | "MULTI_DATE",
  placeId: "required",
  scheduleJson: {
    date: "2026-03-15",
    time: "10:00"
  }
}
// → Appears in: "Куда пойти"
```

### COURSE - Курс/занятие
```typescript
{
  type: "COURSE",
  scheduleMode: "RECURRING" | "ON_DEMAND",
  placeId: "required",
  scheduleJson: {
    weekdays: ["monday", "wednesday"],
    time: "15:00"
  }
}
// → Appears in: "Занятия"
```

### PERMANENT - Постоянное место
```typescript
{
  type: "PERMANENT",
  scheduleMode: "ALWAYS" | "ON_DEMAND",
  placeId: "required",
  scheduleJson: null
}
// → Appears in: "Куда пойти" + "Всегда рядом"
```

### ROUTE - Маршрут
```typescript
{
  type: "ROUTE",
  scheduleMode: "ON_DEMAND",
  placeId: null, // Optional for ROUTE
  scheduleJson: {
    waypoints: [...]
  }
}
// → Appears in: "Куда пойти"
```

### OFFER - Предложение для ДР
```typescript
{
  type: "OFFER",
  scheduleMode: "ON_DEMAND",
  placeId: "required",
  priceFrom: 100,
  priceTo: 300,
  priceText: "от 100 BYN"
}
// → Appears in: "Куда пойти" (for birthday constructor)
```

## Schedule Modes

### ONE_TIME
Single date and time
```json
{
  "scheduleMode": "ONE_TIME",
  "scheduleJson": {
    "date": "2026-03-15",
    "time": "10:00"
  },
  "nextOccurrenceAt": "2026-03-15T10:00:00Z"
}
```

### MULTI_DATE
Multiple specific dates
```json
{
  "scheduleMode": "MULTI_DATE",
  "scheduleJson": {
    "dates": [
      { "date": "2026-03-15", "time": "10:00" },
      { "date": "2026-03-22", "time": "10:00" }
    ]
  },
  "nextOccurrenceAt": "2026-03-15T10:00:00Z"
}
```

### RECURRING
Repeating schedule
```json
{
  "scheduleMode": "RECURRING",
  "scheduleJson": {
    "weekdays": ["monday", "wednesday", "friday"],
    "time": "15:00",
    "startDate": "2026-03-01",
    "endDate": "2026-06-30"
  }
}
```

### ON_DEMAND
Available on request
```json
{
  "scheduleMode": "ON_DEMAND",
  "scheduleJson": {
    "availability": "Call to schedule",
    "leadTime": "24 hours"
  }
}
```

### ALWAYS
Always available
```json
{
  "scheduleMode": "ALWAYS",
  "scheduleJson": {
    "openingHours": {
      "monday": "09:00-18:00",
      "tuesday": "09:00-18:00"
    }
  }
}
```

## Auto-Classification

Use helper functions to show which sections an activity will appear in:

```typescript
import {
  getActivitySections,
  getActivitySectionLabels,
  getPrimarySection,
  isPlaceRequired
} from "@/lib/activity/classification";

// Get sections
const sections = getActivitySections("COURSE", "RECURRING");
// → ["classes"]

// Get labels
const labels = getActivitySectionLabels("PERMANENT", "ALWAYS");
// → ["Куда пойти", "Всегда рядом"]

// Get primary section
const primary = getPrimarySection("EVENT", "ONE_TIME");
// → "where-to-go"

// Check if place is required
const needsPlace = isPlaceRequired("ROUTE");
// → false
```

## UI Hints

Show automatic section assignment to business owners:

```tsx
function ActivitySectionHint({ type, scheduleMode }) {
  const labels = getActivitySectionLabels(type, scheduleMode);
  
  return (
    <div className="bg-blue-50 p-3 rounded-md">
      <p className="text-sm text-blue-800">
        Будет опубликовано в: <strong>{labels.join(", ")}</strong>
      </p>
    </div>
  );
}
```

## Validation

### Required for Submit
- title (non-empty)
- shortDesc (non-empty)
- type (valid ActivityType)
- scheduleMode (valid ScheduleMode)
- placeId (required except for ROUTE)
- ageTags (at least one)
- coverImageId (required)

### Optional
- description
- scheduleJson
- nextOccurrenceAt
- priceFrom, priceTo, priceText
- currency

## Status Flow

```
DRAFT → PENDING → PUBLISHED
              ↓
         NEEDS_CHANGES → (fix) → PENDING
              ↓
         REJECTED → (fix) → PENDING
```

## API Reference

### Create Activity
```
POST /api/business/activities-v2
Body: { type, placeId }
Returns: { activity }
```

### List Activities
```
GET /api/business/activities-v2?status=DRAFT&type=EVENT
Returns: { activities }
```

### Get Activity
```
GET /api/business/activities-v2/[id]
Returns: { activity }
```

### Update Activity
```
PATCH /api/business/activities-v2/[id]
Body: { title, shortDesc, ... }
Returns: { activity }
```

### Submit for Moderation
```
POST /api/business/activities-v2/[id]/submit
Returns: { success, activity } or { error: "VALIDATION", missing, fields }
```

### Delete Activity
```
DELETE /api/business/activities-v2/[id]
Returns: { success }
```

## Examples

### Create Event
```typescript
// 1. Create
const { activity } = await fetch('/api/business/activities-v2', {
  method: 'POST',
  body: JSON.stringify({
    type: 'EVENT',
    placeId: 'place-123'
  })
}).then(r => r.json());

// 2. Update
await fetch(`/api/business/activities-v2/${activity.id}`, {
  method: 'PATCH',
  body: JSON.stringify({
    title: 'Summer Festival',
    shortDesc: 'Fun for the whole family',
    scheduleMode: 'ONE_TIME',
    scheduleJson: {
      date: '2026-07-15',
      time: '14:00'
    },
    nextOccurrenceAt: '2026-07-15T14:00:00Z',
    ageTags: ['0-3', '3-7', '7-12'],
    coverImageId: 'img-123'
  })
});

// 3. Submit
const result = await fetch(`/api/business/activities-v2/${activity.id}/submit`, {
  method: 'POST'
}).then(r => r.json());

if (result.error === 'VALIDATION') {
  console.log('Missing:', result.missing);
  console.log('Errors:', result.fields);
}
```

### Create Course
```typescript
const { activity } = await fetch('/api/business/activities-v2', {
  method: 'POST',
  body: JSON.stringify({
    type: 'COURSE',
    placeId: 'place-123'
  })
}).then(r => r.json());

await fetch(`/api/business/activities-v2/${activity.id}`, {
  method: 'PATCH',
  body: JSON.stringify({
    title: 'English for Kids',
    shortDesc: 'Interactive English lessons',
    scheduleMode: 'RECURRING',
    scheduleJson: {
      weekdays: ['tuesday', 'thursday'],
      time: '16:00',
      startDate: '2026-09-01',
      endDate: '2027-05-31'
    },
    ageTags: ['7-12'],
    priceFrom: 80,
    priceText: 'от 80 BYN/месяц',
    coverImageId: 'img-456'
  })
});
```

## Best Practices

1. **Always show section hints** - Let business owners know where their activity will appear
2. **Validate placeId** - Check if place is required for the activity type
3. **Use autosave** - Save changes frequently with PATCH
4. **Strict validation on submit** - Show clear error messages
5. **Handle NEEDS_CHANGES** - Display moderator feedback prominently
6. **Update nextOccurrenceAt** - Keep it in sync with scheduleJson for efficient queries

## Common Patterns

### Activity with recurring schedule
```typescript
{
  type: "COURSE",
  scheduleMode: "RECURRING",
  scheduleJson: {
    weekdays: ["monday", "wednesday"],
    time: "15:00"
  }
}
// Auto-classified as: "Занятия"
```

### Activity always available
```typescript
{
  type: "PERMANENT",
  scheduleMode: "ALWAYS"
}
// Auto-classified as: "Куда пойти" + "Всегда рядом"
```

### Activity without place
```typescript
{
  type: "ROUTE",
  placeId: null // OK for ROUTE
}
// Auto-classified as: "Куда пойти"
```
