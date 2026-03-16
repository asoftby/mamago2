# Stable Card Selector Pattern

## Overview

The Stable Card Selector pattern fixes jumpy expand/collapse behavior in wizard card-based selections by implementing radio-style selection with stable animations and preventing unwanted toggle behavior.

## Problem Solved

Previously, card-based selections in the Offer Wizard had several UX issues:
- **Jumpy animations**: Cards would "bounce" or "jump" when expanding/collapsing
- **Toggle behavior**: Clicking a selected card would deselect it (toggle to null)
- **Layout instability**: Whole card containers would animate, causing layout shifts
- **Context loss**: Nested forms would remount, causing flicker and focus loss
- **Inconsistent behavior**: Different steps had different selection patterns

## Solution: StableCardSelector Component

### Key Features

1. **Radio Behavior**: Once selected, clicking the same card again does nothing (no toggle to null)
2. **Stable Layout**: Only the nested content area animates, not the entire card
3. **Smooth Animations**: Premium 200ms ease-out transitions with opacity and translateY
4. **Prevent Remounting**: Nested forms stay mounted and stable during interactions
5. **Consistent Styling**: Unified brand color (#EF8759) and visual states

### Components

#### `StableCardSelector<T>`
Main component for primary selections (offer types, action types)
- Large cards with icons
- Full-width layout
- Standard padding and spacing

#### `StableCardSelectorSmall<T>`
Smaller variant for nested selections (booking modes, service types)
- Compact cards
- Reduced padding
- Faster animations (180ms)

### Usage Example

```tsx
import { StableCardSelector } from "@/components/ui/stable-card-selector";

const options = [
  {
    value: "course" as const,
    label: "Курс / занятия",
    description: "Регулярные занятия и секции для детей",
    icon: GraduationCap,
    isRecommended: true,
  },
  // ... more options
];

<StableCardSelector
  value={selectedValue}
  onValueChange={handleValueChange}
  options={options}
  isEditable={isEditable}
>
  {(selectedValue) => (
    <NestedFormComponent value={selectedValue} />
  )}
</StableCardSelector>
```

### Animation Specifications

- **Duration**: 200ms (main), 180ms (small)
- **Easing**: ease-out
- **Properties**: 
  - `opacity: 0 → 1`
  - `transform: translateY(8px) → translateY(0)`
- **Classes**: `animate-in fade-in-0 slide-in-from-top-2 duration-200 ease-out`

### Visual States

1. **Default**: Gray border, hover effects
2. **Selected**: Brand color ring and border (#EF8759)
3. **Recommended**: "Рекомендуется" badge
4. **Disabled**: Reduced opacity, no cursor

### Behavior Rules

1. **Selection**: Only unselected cards can be selected
2. **No Toggle**: Selected cards ignore additional clicks
3. **Context Preservation**: Nested content never remounts unnecessarily
4. **Stable Layout**: Card container dimensions remain constant
5. **Smooth Transitions**: Only nested content area animates

## Implementation in Offer Wizard

### Step 1: Offer Type Selection
- Uses `StableCardSelector` for main offer types
- Nested course format and service settings
- No more jumpy behavior when switching types

### Step 7: Action Selection
- Uses `StableCardSelector` for CTA types
- Nested booking settings with `StableCardSelectorSmall`
- Three-level nesting: Action → Booking Mode → Settings

### Benefits Achieved

1. **Premium UX**: Smooth, predictable animations
2. **No Context Loss**: Users never lose their place in forms
3. **Consistent Behavior**: Same pattern across all wizard steps
4. **Better Performance**: Reduced DOM thrashing and reflows
5. **Accessibility**: Stable focus management and screen reader support

## Migration Guide

To convert existing card selectors to the stable pattern:

1. Replace custom card components with `StableCardSelector`
2. Remove toggle-to-null logic from handlers
3. Move nested content inside the children render function
4. Remove manual animation classes from nested content
5. Test for stable behavior and smooth animations

## Future Extensions

The pattern can be extended to support:
- Multi-select mode (checkbox behavior)
- Keyboard navigation
- Custom animation presets
- Validation states
- Loading states

This pattern ensures all card-based selections in the wizard feel stable, premium, and predictable, eliminating the jumpy behavior that previously degraded the user experience.