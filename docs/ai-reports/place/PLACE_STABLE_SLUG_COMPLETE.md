# Place Stable Slug System - Complete

## Overview

Implemented stable, SEO-friendly slug system for Place with the following principles:

### Key Principles

1. **Slug is permanent** - assigned once when place is first published
2. **No automatic changes** - slug never changes even if title/address changes
3. **Business cannot edit** - only admins/moderators can change slug manually
4. **Smart duplicate handling** - first place gets short slug, duplicates get address-based slug

## Slug Generation Logic

### Strategy

When a new place is published:

**Step 1: Check for duplicates**
- Normalize title (lowercase, trim, collapse spaces)
- Check if other PUBLISHED places exist with same normalized title in same city

**Step 2: Generate slug**
- **If unique in city** → short slug: `pugovka`
- **If duplicates exist** → address-based slug: `pugovka-na-vostochnoy`

**Step 3: Ensure uniqueness**
- If slug already taken → add numeric suffix: `pugovka-na-vostochnoy-2`

### Examples

```
First "Пуговка" in Minsk:
  → slug: pugovka

Second "Пуговка" in Minsk (ул. Восточная):
  → slug: pugovka-na-vostochnoy

Third "Пуговка" in Minsk (ул. Притыцкого):
  → slug: pugovka-na-pritytskogo

"Пуговка" in Brest:
  → slug: pugovka (different city, no conflict)
```

### Address Format

New slug format uses genitive case with "na" (на):
- `pugovka-na-vostochnoy` (Пуговка на Восточной)
- `pugovka-na-pritytskogo` (Пуговка на Притыцкого)

This is more natural in Russian/Belarusian than including house numbers.

## Display Titles (UI)

Slug is for URLs only. Display titles in UI are separate:

- **If unique in city**: "Пуговка"
- **If duplicates exist**: "Пуговка — Восточная"

Display titles show clean street name without "na" construction.

## Implementation

### Files Changed

**Core Utilities:**
- `src/lib/slug/slugUtils.ts` - transliteration, normalization, slug generation
  - `slugify()` - convert text to URL-safe slug
  - `normalizePlaceName()` - normalize for duplicate detection
  - `getStreetGenitive()` - convert street to genitive form
  - `buildBasePlaceSlug()` - short slug for unique names
  - `buildAddressPlaceSlug()` - address-based slug for duplicates
  - `getStreetLabel()` - extract street name for UI display

**Slug Service:**
- `src/lib/slug/placeSlugService.ts` - slug management
  - `generatePlaceSlug()` - generate optimal slug for new place
  - `assignSlugOnPublish()` - assign slug when place is first published
  - `updatePlaceSlug()` - update slug (admin only, saves old to history)
  - `findPlaceBySlug()` - find place by current or historical slug

**Display Titles:**
- `src/lib/placeDisplayTitle.ts` - UI display logic
  - `hasDuplicateTitleInCity()` - check for duplicates
  - `getDisplayTitle()` - build display title with street if needed
  - `getPlaceDisplayTitle()` - async version with duplicate check

**Integration:**
- `src/server/services/moderation.service.ts` - calls `assignSlugOnPublish()` when approving place

**Public Route:**
- `src/app/(public)/places/[slug]/page.tsx` - handles slug lookup and redirects

### Database Schema

Already exists from previous implementation:

```prisma
model Place {
  slug           String?   @unique
  slugUpdatedAt  DateTime?
  // ... other fields
}

model PlaceSlugHistory {
  id        String   @id @default(cuid())
  placeId   String
  slug      String   @unique
  createdAt DateTime @default(now())
  
  place Place @relation(fields: [placeId], references: [id], onDelete: Cascade)
  
  @@index([placeId])
}
```

## Workflow

### Creating New Place

1. Business creates place in wizard
2. Business submits for moderation (status: PENDING)
3. Moderator approves place (status: PUBLISHED)
4. **Slug is automatically assigned** using `assignSlugOnPublish()`
5. Place is accessible at `/places/{slug}`

### Editing Existing Place

1. Business edits title/address
2. **Slug does NOT change** (stability for SEO)
3. Display title updates if needed (shows street for duplicates)

### Admin Slug Management

Admins can manually change slug if needed:
- Old slug is saved to `PlaceSlugHistory`
- Old URL redirects to new slug
- This should be rare - only for fixing mistakes

## SEO Benefits

1. **Stable URLs** - slug never changes automatically
2. **Human-readable** - `pugovka-na-vostochnoy` vs `cmmj9eggc0009wsvnpqrmilie`
3. **Redirects** - old slugs redirect to current slug (301 permanent)
4. **No broken links** - slug history preserves all old URLs

## Testing

### Test Script

```bash
npx tsx scripts/test-stable-slug-logic.ts
```

Tests:
- First place gets short slug
- Duplicates get address-based slug
- Different cities don't conflict
- Display titles show street for duplicates

### Migration Script

```bash
npx tsx scripts/data-migrations/migrate-to-stable-slugs.ts
```

Migrates existing places to new slug logic (preserves old slugs in history).

### Check Place URL

```bash
npx tsx scripts/check-place-url.ts [place-id]
```

Shows slug, URL, and slug history for a place.

### List All URLs

```bash
npx tsx scripts/list-place-urls.ts
```

Lists all published places with their URLs.

## Edge Cases

### Same Name, Different Cities

Places with same name in different cities don't conflict:
- "Пуговка" in Minsk → `pugovka`
- "Пуговка" in Brest → `pugovka` (different city)

### No Address Available

If place has no address (rare):
- Falls back to base slug: `pugovka`
- Adds numeric suffix if needed: `pugovka-2`

### Slug Collision

If generated slug is already taken:
- Adds numeric suffix: `pugovka-na-vostochnoy-2`
- This should be very rare with address-based slugs

### Title/Address Changes

If business changes title or address after publication:
- **Slug stays the same** (SEO stability)
- Display title updates if needed
- Only admin can manually change slug

## Future Enhancements

### Admin UI for Slug Management

Could add admin interface to:
- View current slug and history
- Manually change slug (with warning)
- Preview how slug will look

### Bulk Slug Regeneration

Could add script to regenerate all slugs (with confirmation):
- Useful if slug generation logic changes
- Preserves old slugs in history
- Should be used carefully (SEO impact)

### Slug Analytics

Could track:
- Which slugs get most traffic
- Which old slugs are still being used (redirects)
- Identify places that need better slugs

## Summary

✅ Slug is assigned once when place is first published
✅ Slug never changes automatically (SEO stability)
✅ First place with unique name gets short slug
✅ Duplicates get address-based slug with genitive form
✅ Old slugs redirect to current slug (SEO-friendly)
✅ Display titles show clean street name for duplicates
✅ Business cannot edit slug (only admins)
✅ All existing places migrated to new system

The slug system is now stable, SEO-friendly, and handles duplicates intelligently.
