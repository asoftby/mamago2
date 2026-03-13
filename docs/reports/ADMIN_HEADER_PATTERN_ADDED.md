# Admin Header Pattern Added to UI Lab

## Overview
Added comprehensive Header pattern documentation to `/ui-lab-admin` showing desktop and mobile header behavior with burger menu.

## Location
- **File**: `src/app/(ui)/ui-lab-admin/_sections/HeaderSection.tsx`
- **Section**: Header (Section 0)
- **Position**: After Typography, before Page Structure

## Pattern Components

### 1. Desktop Header
- **Height**: `h-16` (64px)
- **Layout**: Brand (left) → Search (center) → Utilities (right)
- **Components**:
  - Brand/Logo: `font-bold text-lg`
  - Search bar: Full width input with icon
  - Notifications: Bell icon with badge
  - Account: Avatar with user icon
- **No burger menu** - sidebar always visible on desktop

### 2. Mobile Header (Standard)
- **Height**: `h-14` (56px)
- **Layout**: Burger (left) → Brand (center) → Utilities (right)
- **Components**:
  - Burger menu: `Menu` icon, opens navigation drawer
  - Compact brand: `font-bold text-base`
  - Notifications: Bell icon with badge
  - Account: Smaller avatar `w-7 h-7`
- **Burger menu visible** - opens sidebar drawer

### 3. Mobile Header (with Search)
- Alternative layout with search trigger
- **Layout**: Burger (left) → Search trigger (center) → Utilities (right)
- Search trigger: `bg-gray-100` button that opens search modal
- Use when search is primary action

## Design Specifications

### Header Heights
- Desktop: `h-16` (64px)
- Mobile: `h-14` (56px)

### Icon Sizes
- Desktop icons: `h-5 w-5` (20px)
- Mobile icons: `h-5 w-5` (20px)
- Desktop avatar: `w-8 h-8` (32px)
- Mobile avatar: `w-7 h-7` (28px)

### Spacing
- Desktop horizontal padding: `px-6`
- Mobile horizontal padding: `px-4`

### Colors
- Background: `bg-white`
- Border: `border-gray-200`
- Text: `text-gray-900` (brand), `text-gray-600` (icons)
- Hover: `hover:bg-gray-100`
- Notification badge: `bg-red-500`

## Navigation Behavior

### Desktop
- Sidebar is always visible
- Burger menu is hidden
- Full search bar in header
- Brand/logo on left side

### Mobile
- Sidebar is hidden by default
- Burger menu visible on left
- Burger opens navigation drawer/sheet
- Compact brand or search trigger in center
- Utilities (notifications, account) on right

## Key Features

1. **Responsive Layout**: Different layouts for desktop and mobile
2. **Burger Menu**: Only visible on mobile to open sidebar
3. **Search Variants**: Full bar (desktop) or trigger (mobile)
4. **Notification Badge**: Red dot indicator for unread items
5. **Consistent Heights**: Standard heights for both breakpoints

## Usage Guidelines

### When to Use Desktop Pattern
- Screen width ≥ 768px (md breakpoint)
- Sidebar has space to be always visible
- Full search functionality needed

### When to Use Mobile Pattern
- Screen width < 768px
- Limited horizontal space
- Need collapsible navigation

### Burger Menu Behavior
- Opens navigation drawer from left
- Drawer overlays content
- Close button or backdrop dismisses
- Should include same navigation as desktop sidebar

## Implementation Notes

1. **Pattern Only**: This is documentation, not the real header
2. **Real Implementation**: Separate from UI Lab
3. **Consistency**: Real header should follow these patterns
4. **Icons**: Using lucide-react (Menu, Bell, User, Search)
5. **Responsive**: Use Tailwind breakpoints (md:)

## Files Modified

- Created: `src/app/(ui)/ui-lab-admin/_sections/HeaderSection.tsx`
- Modified: `src/app/(ui)/ui-lab-admin/page.tsx` (added HeaderSection import and render)

## Benefits

- **Clear Documentation**: Explicit desktop and mobile patterns
- **Burger Menu Pattern**: Shows when and how to use burger menu
- **Responsive Guidance**: Clear breakpoint behavior
- **Consistent Heights**: Standard header heights documented
- **Icon Sizing**: Consistent icon and avatar sizes
