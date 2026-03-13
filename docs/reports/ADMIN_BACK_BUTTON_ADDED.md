# Admin Back Button Implementation

## Overview

Added back button navigation to all admin pages (except dashboard) for better UX and easier navigation.

## Components Created

### 1. BackButton Component

**File:** `src/components/admin/BackButton.tsx`

Simple back button with router navigation:

```tsx
<BackButton href="/admin" label="Назад" />
```

**Features:**
- Uses Next.js router for navigation
- Can navigate to specific href or use browser back()
- Responsive: Shows icon + text on desktop, icon only on mobile
- Ghost button style with left arrow icon
- Negative left margin (-ml-2) for alignment

**Props:**
- `href?: string` - Optional specific URL to navigate to (default: browser back)
- `label?: string` - Button text (default: "Назад")

### 2. AdminPageHeader Component

**File:** `src/components/admin/AdminPageHeader.tsx`

Standardized page header with optional back button:

```tsx
<AdminPageHeader
  title="Billing Overview"
  subtitle="Финансовое состояние системы"
  showBackButton={true}
  backHref="/admin"
  actions={<Button>Action</Button>}
/>
```

**Features:**
- Consistent header layout across all admin pages
- Optional back button (enabled by default)
- Optional subtitle
- Optional action buttons on the right
- Responsive layout

**Props:**
- `title: string` - Page title (required)
- `subtitle?: string` - Optional subtitle
- `showBackButton?: boolean` - Show/hide back button (default: true)
- `backHref?: string` - Back button destination (default: "/admin")
- `actions?: React.ReactNode` - Optional action buttons

## Pages Updated

### 1. Billing Overview
**File:** `src/app/admin/billing/page.tsx`
- Added AdminPageHeader with back button
- Back button navigates to `/admin` (dashboard)

### 2. Commercial Overview
**File:** `src/app/admin/commercial/page.tsx`
- Added AdminPageHeader with back button
- Back button navigates to `/admin` (dashboard)

## Usage Pattern

### For new admin pages:

```tsx
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default function MyAdminPage() {
  return (
    <div className="p-6 md:p-4 space-y-6">
      <AdminPageHeader
        title="Page Title"
        subtitle="Optional description"
      />
      
      {/* Page content */}
    </div>
  );
}
```

### For dashboard (no back button):

```tsx
<AdminPageHeader
  title="Dashboard"
  subtitle="Обзор платформы"
  showBackButton={false}
/>
```

### With custom back destination:

```tsx
<AdminPageHeader
  title="Transaction Details"
  subtitle="View transaction information"
  backHref="/admin/billing/transactions"
/>
```

### With action buttons:

```tsx
<AdminPageHeader
  title="Users"
  subtitle="Manage users"
  actions={
    <>
      <Button variant="outline">Export</Button>
      <Button>Add User</Button>
    </>
  }
/>
```

## Responsive Behavior

### Desktop:
- Back button shows icon + "Назад" text
- Full page title and subtitle visible
- Action buttons on the right

### Mobile:
- Back button shows icon only (no text)
- Page title and subtitle adapt to smaller font sizes
- Action buttons stack if needed

## Design Specs

### Back Button:
- Icon: `ArrowLeft` from lucide-react
- Size: `w-4 h-4`
- Variant: `ghost`
- Size: `sm`
- Gap: `gap-2` between icon and text
- Margin: `-ml-2` for alignment

### Header Layout:
- Flex container with space-between
- Left side: Back button + Title/Subtitle
- Right side: Optional actions
- Gap: `gap-3` between elements

## Next Steps

To add back button to remaining admin pages:

1. Import AdminPageHeader component
2. Replace existing header div with AdminPageHeader
3. Set appropriate title and subtitle
4. Optionally customize backHref if not going to dashboard

Example pages to update:
- `/admin/users`
- `/admin/media`
- `/admin/moderation/places`
- `/admin/moderation/queue`
- `/admin/billing/transactions`
- `/admin/billing/plans`
- `/admin/billing/businesses`
- `/admin/commercial/contracts`
- `/admin/commercial/placements`
- `/admin/commercial/service-placements`
- `/admin/taxonomy/signals`
- `/admin/taxonomy/districts`
- `/admin/taxonomy/metro-stations`
- `/admin/b2b/partners`

## Benefits

1. **Better UX**: Easy navigation back to previous page or dashboard
2. **Consistency**: All admin pages have same header pattern
3. **Mobile-friendly**: Icon-only button on mobile saves space
4. **Flexible**: Can customize back destination and add actions
5. **Maintainable**: Single component to update for all pages

## Conclusion

The back button and standardized header improve admin panel navigation and provide a consistent, professional experience across all pages.
