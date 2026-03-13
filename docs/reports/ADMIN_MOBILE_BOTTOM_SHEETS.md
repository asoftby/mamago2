# Admin Mobile Bottom Sheets Implementation

## Overview

Converted admin panel mobile overlays from dropdowns to bottom sheets for better mobile UX. Notifications and profile menu now use native-feeling bottom sheets on mobile devices while maintaining dropdown behavior on desktop.

## Changes Made

### 1. Created useMediaQuery Hook

**File:** `src/hooks/useMediaQuery.ts`

Simple React hook for responsive breakpoint detection:

```tsx
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    const media = window.matchMedia(query);
    // ... listener logic
  }, [matches, query]);
  
  return matches;
}
```

**Usage:**
```tsx
const isMobile = useMediaQuery("(max-width: 1023px)");
```

### 2. Mobile Navigation - Bottom Sheet (Not Left Drawer)

**File:** `src/components/admin/AdminHeader.tsx`

**Changed from left drawer to bottom sheet for better mobile UX:**

```tsx
{/* Bottom Sheet Navigation */}
<Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
  <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b">
        <h3 className="text-base font-semibold">Навигация</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AdminSidebar onNavigate={() => setMobileMenuOpen(false)} />
      </div>
    </div>
  </SheetContent>
</Sheet>
```

**Why Bottom Sheet for Navigation?**
- More natural thumb reach on mobile
- Consistent with other mobile overlays (notifications, profile)
- Better screen space usage (85vh)
- Native mobile app feel
- Easier to dismiss with swipe down

### 3. Updated AdminNotificationsDropdown

**File:** `src/components/admin/notifications/AdminNotificationsDropdown.tsx`

**Changes:**
- Added responsive behavior detection with `useMediaQuery`
- Desktop: Dropdown menu (300px width)
- Mobile: Bottom sheet (70vh height, rounded-t-2xl)
- Shared notification content between both variants
- Improved empty state with icon

**Desktop Behavior:**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger>{notificationButton}</DropdownMenuTrigger>
  <DropdownMenuContent className="w-[300px]">
    {notificationContent}
  </DropdownMenuContent>
</DropdownMenu>
```

**Mobile Behavior:**
```tsx
<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
  <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
    {notificationContent}
  </SheetContent>
</Sheet>
```

### 3. Updated AdminHeader Profile Menu

**File:** `src/components/admin/AdminHeader.tsx`

**Changes:**
- Added responsive profile menu
- Desktop: Dropdown with user info
- Mobile: Bottom sheet with enhanced user card
- Shared menu content between variants
- Auto-close on navigation

**Profile Menu Content:**
- User avatar and email
- Role badge ("Администратор")
- Profile link
- Settings link
- Logout button

**Desktop:**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger>{profileButton}</DropdownMenuTrigger>
  <DropdownMenuContent className="w-64">
    {profileMenuContent}
  </DropdownMenuContent>
</DropdownMenu>
```

**Mobile:**
```tsx
<Sheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen}>
  <SheetContent side="bottom" className="h-auto rounded-t-2xl">
    {profileMenuContent}
  </SheetContent>
</Sheet>
```

### 4. Updated AdminSidebar for Responsive Usage

**File:** `src/components/admin/AdminSidebar.tsx`

**Changes:**
- Made width responsive: `w-full lg:w-[260px]`
- Border only on desktop: `lg:border-r lg:border-gray-200`
- Min-height only on desktop: `lg:min-h-[calc(100vh-4rem)]`
- Works in both contexts: desktop sidebar and mobile bottom sheet

```tsx
<aside className="w-full lg:w-[260px] lg:border-r lg:border-gray-200 bg-white lg:min-h-[calc(100vh-4rem)]">
  <nav className="flex flex-col gap-1.5 p-4">
    {/* Navigation items */}
  </nav>
</aside>
```

### 5. Updated UI Lab Documentation

**File:** `src/app/(ui)/ui-lab-admin/_sections/HeaderSection.tsx`

Added note about mobile overlay behavior:
- Desktop: Dropdown menus (300px width)
- Mobile: Bottom sheets (70vh height, rounded-t-2xl)
- Backdrop: bg-black/50 with auto-close

## Mobile Overlay Patterns

All mobile overlays now use bottom sheet pattern for consistency:

### 1. Navigation Menu
- **Trigger:** Burger menu button (top left)
- **Height:** `85vh` (tall, for full navigation)
- **Header:** "Навигация" title
- **Content:** Full AdminSidebar with all navigation groups
- **Auto-close:** On navigation click

### 2. Notifications
- **Trigger:** Bell icon (top right)
- **Height:** `70vh` (medium, for notification list)
- **Header:** "Уведомления" + unread count
- **Content:** Notification list with scroll
- **Footer:** "View all notifications →" link

### 3. Profile Menu
- **Trigger:** Avatar/email (top right)
- **Height:** `auto` (compact, just menu items)
- **Header:** User card with avatar and email
- **Content:** Profile, Settings, Logout links
- **Auto-close:** On navigation click

## Bottom Sheet Design Specs

### Visual Properties
- **Side:** `bottom` (slides up from bottom)
- **Height:** `70vh` for notifications, `auto` for profile menu
- **Border Radius:** `rounded-t-2xl` (top corners only)
- **Backdrop:** `bg-black/50` with click-to-close
- **Animation:** Slide in/out with 300-500ms duration

### Content Structure
```
┌─────────────────────────┐
│   Handle (optional)     │ ← Visual drag indicator
├─────────────────────────┤
│   Header with title     │ ← Title + close button
├─────────────────────────┤
│                         │
│   Scrollable content    │ ← Main content area
│                         │
├─────────────────────────┤
│   Footer (optional)     │ ← Actions or links
└─────────────────────────┘
```

### Interaction Patterns
1. **Open:** Tap notification bell or profile avatar
2. **Close:** 
   - Tap backdrop
   - Tap close button (X)
   - Swipe down (native sheet behavior)
   - Navigate to another page (auto-close)

## Responsive Breakpoint

**Breakpoint:** `1023px` (lg breakpoint)
- `< 1024px`: Mobile (bottom sheets)
- `≥ 1024px`: Desktop (dropdowns)

**Why lg breakpoint?**
- Matches sidebar visibility breakpoint
- Consistent with admin layout responsive behavior
- Provides enough space for dropdown menus on desktop

## Benefits

### Mobile UX Improvements
1. **Native Feel:** Bottom sheets feel more natural on mobile
2. **Larger Touch Targets:** More space for tapping items
3. **Better Readability:** Full-width content, larger text
4. **Gesture Support:** Swipe to dismiss (native sheet behavior)
5. **No Positioning Issues:** Always anchored to bottom

### Desktop UX Maintained
1. **Compact Dropdowns:** Don't take up full screen
2. **Contextual Positioning:** Appear near trigger element
3. **Quick Access:** Hover and click patterns preserved
4. **Professional Look:** Standard dropdown UI pattern

## Testing Checklist

- [ ] Desktop: Navigation sidebar visible on left
- [ ] Mobile: Navigation sidebar hidden
- [ ] Mobile: Burger menu opens navigation as bottom sheet (85vh)
- [ ] Mobile: Navigation sheet has "Навигация" header
- [ ] Mobile: Clicking nav item closes sheet
- [ ] Desktop: Notifications open as dropdown (300px)
- [ ] Mobile: Notifications open as bottom sheet (70vh)
- [ ] Desktop: Profile menu opens as dropdown (264px)
- [ ] Mobile: Profile menu opens as bottom sheet (auto height)
- [ ] Mobile: All sheets have rounded-t-2xl corners
- [ ] Mobile: Backdrop closes sheets on click
- [ ] Mobile: Close button (X) works on notifications
- [ ] Mobile: Swipe down closes sheets
- [ ] Mobile: Navigation auto-closes on link click
- [ ] Desktop: Dropdowns position correctly
- [ ] Responsive: Switches at 1024px breakpoint
- [ ] Empty state: Shows icon and message
- [ ] Unread badge: Displays on notification bell
- [ ] All three overlays feel consistent on mobile

## Files Modified

1. `src/hooks/useMediaQuery.ts` - New responsive hook
2. `src/components/admin/AdminHeader.tsx` - Navigation, notifications, and profile as bottom sheets
3. `src/components/admin/AdminSidebar.tsx` - Responsive width and borders for dual usage
4. `src/components/admin/notifications/AdminNotificationsDropdown.tsx` - Bottom sheet for mobile
5. `src/app/(ui)/ui-lab-admin/_sections/HeaderSection.tsx` - Documentation update

## No Breaking Changes

- Desktop behavior unchanged
- All existing functionality preserved
- Mobile experience enhanced
- No API or data changes
- No routing changes

## Future Enhancements

1. Add swipe-to-dismiss gesture indicator
2. Implement haptic feedback on mobile
3. Add notification grouping by date
4. Add "Mark all as read" action
5. Add notification preferences link
6. Consider adding notification sounds/vibration
7. Add pull-to-refresh for notifications

## Conclusion

Admin panel now provides a fully native mobile experience with bottom sheets for ALL overlays:
- **Navigation menu** (burger) - 85vh bottom sheet
- **Notifications** - 70vh bottom sheet  
- **Profile menu** - auto-height bottom sheet

All three overlays use consistent patterns, feel natural on mobile, and maintain professional dropdown behavior on desktop. The implementation automatically switches between patterns based on screen size, following modern mobile UX best practices and providing a cohesive, app-like experience.
