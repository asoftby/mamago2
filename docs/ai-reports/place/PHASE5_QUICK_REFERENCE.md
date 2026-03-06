# Phase 5: Admin Moderation UI - Quick Reference

## What Was Implemented

Phase 5 created a unified admin moderation experience for both initial Place publication and post-publication updates through revisions.

## Key Pages

### 1. Moderation Queue
**URL:** `/admin/moderation/queue`

Shows all pending items:
- [PLACE] - Initial Place submissions (blue icon)
- [UPDATE] - Place revision submissions (amber icon)

Sorted by submission time (oldest first).

### 2. Place Moderation
**URL:** `/admin/moderation/places/[id]`

Reviews initial Place submissions with full content preview.

### 3. Revision Moderation
**URL:** `/admin/moderation/places/[id]?mode=revision`

Reviews Place updates with before/after comparison.

## Key Features

### Unified Queue
- Single view for all moderation work
- Clear type indicators
- Direct links to review pages

### Comparison View
- Side-by-side before/after
- Highlights changed fields (yellow)
- Shows unchanged fields (gray)
- Arrow indicators for changes

### Sticky Moderation Panel
- Always visible while scrolling
- Shows context (type, status, business)
- Comment textarea
- Action buttons

## Actions

### Initial Place
- **Approve** → Publishes Place
- **Needs Revision** → Requests changes (requires comment)
- **Reject** → Rejects Place (requires comment)

### Place Update
- **Approve** → Copies changes to live Place
- **Needs Revision** → Requests changes (requires comment)
- **Reject** → Rejects changes (requires comment)

## API Endpoints

```typescript
// Initial Place
POST /api/admin/moderation/places/[id]
Body: { action, comment }

// Place Revision
POST /api/admin/moderation/revisions/[id]
Body: { action, comment }
```

## Visual Indicators

**Type Badges:**
- PLACE: Blue FileText icon
- UPDATE: Amber RefreshCw icon

**Changed Fields:**
- Background: Yellow-50
- Border: Yellow-200
- Arrow: → (yellow)

**Action Buttons:**
- Approve: Green
- Needs Revision: Gray outline
- Reject: Red

## Navigation Flow

```
Queue → Review → Action → Back to Queue
```

## Files Created

1. `src/app/admin/moderation/queue/page.tsx`
2. `src/app/admin/moderation/places/[id]/page.tsx`
3. `src/components/admin/PlaceRevisionModerationView.tsx`

## Testing

Run manual tests to verify:
- Queue shows correct items
- Type indicators display
- Review pages load
- Comparison highlights changes
- Actions work correctly
- Redirects to queue

## Next Phase

Phase 6: Notification types for revision actions
