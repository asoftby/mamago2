# Place Card Status Duplicate Fix

## Status: ✅ FIXED

## Problem

Place cards in the business cabinet showed duplicate status information:
1. Status badge on the left (e.g., "На модерации")
2. Status button on the right (e.g., "На модерации")

This created visual noise and redundant information.

## Solution

Removed the left-side status badge and kept only the right-side button as the status indicator.

### Status Button Mapping

| Status | Button Text | Button State | Action |
|--------|-------------|--------------|--------|
| DRAFT | "Продолжить" | Active | Navigate to edit |
| PENDING | "На модерации" | Disabled | No action (visual indicator) |
| PUBLISHED | "Редактировать" | Active | Navigate to edit |
| NEEDS_CHANGES | "Исправить" | Active | Navigate to edit |
| REJECTED | "Исправить" | Active | Navigate to edit |

## Changes Made

### File: `src/components/business/places/PlaceCardHorizontal.tsx`

**Removed:**
- Status badge component (`<Badge>`)
- Badge import from `@/components/ui/badge`

**Kept:**
- Status button (acts as both action and status indicator)
- Button remains disabled for PENDING status
- Button text reflects the status and available action

## Benefits

1. ✅ Cleaner UI - no duplicate information
2. ✅ Less visual noise
3. ✅ Button serves dual purpose (status indicator + action)
4. ✅ Consistent with modern UI patterns

## Testing

To verify the fix:
1. Navigate to `/business/places`
2. Check place cards with different statuses:
   - DRAFT: Should show "Продолжить" button (active)
   - PENDING: Should show "На модерации" button (disabled)
   - PUBLISHED: Should show "Редактировать" button (active)
3. Verify no status badge appears on the left side
4. Verify button correctly indicates status and allows action when appropriate

## Files Changed

- `src/components/business/places/PlaceCardHorizontal.tsx` - Removed duplicate status badge
