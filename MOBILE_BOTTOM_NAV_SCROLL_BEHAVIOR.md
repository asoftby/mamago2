# Mobile Bottom Navigation Scroll Behavior

## ✅ Implemented Feature

Added smart scroll behavior to the mobile bottom navigation bar:
- **Hides** when scrolling down (after 100px threshold)
- **Shows** when scrolling up or at the top of the page
- Smooth animations with CSS transitions

## 🔧 Implementation

### 1. Created Scroll Direction Hook
**File**: `src/hooks/useScrollDirection.ts`

Features:
- Tracks scroll direction (`up`, `down`, or `null`)
- Monitors if page is scrolled beyond threshold
- Uses `requestAnimationFrame` for optimal performance
- Configurable threshold (default: 10px, bottom nav uses 100px)
- Prevents jitter with minimum scroll distance detection

```typescript
export function useScrollDirection(threshold: number = 10) {
  const [scrollDirection, setScrollDirection] = useState<"up" | "down" | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  // ... implementation
  return { scrollDirection, isScrolled };
}
```

### 2. Updated Mobile Bottom Navigation
**File**: `src/components/mobile/MobileBottomNav.tsx`

Changes:
- Added `useScrollDirection(100)` hook
- Conditional hiding logic: `scrollDirection === "down" && isScrolled`
- Smooth CSS transitions: `transition-transform duration-300 ease-in-out`
- Transform animation: `translate-y-full` (hide) / `translate-y-0` (show)

```tsx
const { scrollDirection, isScrolled } = useScrollDirection(100);
const shouldHide = scrollDirection === "down" && isScrolled;

<nav className={cn(
  "fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-in-out",
  shouldHide ? "translate-y-full" : "translate-y-0"
)}>
```

## 📱 User Experience

### Behavior:
1. **Initial state**: Bottom nav is visible
2. **Scroll down >100px**: Bottom nav slides down and disappears
3. **Scroll up**: Bottom nav immediately slides up and appears
4. **At top of page**: Bottom nav is always visible

### Benefits:
- **More screen real estate** when reading content
- **Quick access** when changing scroll direction
- **Smooth animations** for polished feel
- **Performance optimized** with RAF and passive listeners

## 🎯 Technical Details

### Scroll Detection:
- **Threshold**: 100px (prevents hiding on small scrolls)
- **Direction sensitivity**: Minimum 10px movement to change direction
- **Performance**: Uses `requestAnimationFrame` and passive event listeners

### Animation:
- **Duration**: 300ms
- **Easing**: `ease-in-out`
- **Transform**: `translateY(100%)` for hiding
- **Safe area**: Respects `env(safe-area-inset-bottom)`

### Hook Reusability:
The `useScrollDirection` hook can be reused for other components that need scroll-aware behavior:
- Headers
- Floating action buttons
- Sidebars
- Any scroll-responsive UI elements

## 🧪 Testing Scenarios

1. **Scroll down slowly**: Nav should hide after 100px
2. **Scroll down quickly**: Nav should hide smoothly
3. **Scroll up from middle**: Nav should appear immediately
4. **Small scroll movements**: Nav should not flicker
5. **At page top**: Nav should always be visible
6. **Page refresh**: Nav should be in correct initial state

## ✨ Future Enhancements

Potential improvements:
- Add fade effect in addition to slide
- Different thresholds for different pages
- Gesture-based showing/hiding
- Integration with page loading states