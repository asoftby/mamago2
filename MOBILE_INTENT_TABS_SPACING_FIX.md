# Mobile Intent Tabs Spacing & Visual Enhancement

## ✅ Changes Made

### 1. Further Reduced Spacing Between Tabs
**File**: `src/components/mobile/MobileIntentTabs.tsx`
- Changed gap between tabs: `gap-4` → `gap-2` (16px → 8px)
- Reduced individual tab gap: `gap-2` → `gap-1` (8px → 4px between icon and text)
- Made tabs more compact: `min-w-[90px]` → `min-w-[80px]`

### 2. Added Orange Underline for Active Tab (Text-Width)
**File**: `src/components/mobile/MobileIntentTabs.tsx`
- Added orange underline indicator that matches the width of the text
- Uses brand color: `bg-[#EF8759]`
- Positioned relative to the text span: `absolute -bottom-1 left-0 right-0`
- Smooth transitions with `transition-all duration-200`
- Automatically adjusts to different text lengths

### 3. Refined Icon Sizes
**File**: `src/components/mobile/MobileIntentTabs.tsx`
- Slightly reduced icon sizes for more compact layout:
  - Active icons: `30px` → `28px`
  - Inactive icons: `28px` → `26px`
- Removed drop shadow effect for cleaner look

### 4. Left Alignment (Previous)
- Tabs align to the left edge with same padding as search form (`px-4`)
- Consistent with search form layout

### 5. Reduced Container Padding (Previous)
**File**: `src/components/site/header/SiteHeader.mobile.tsx`
- Intent tabs container padding: `py-4` → `py-2`

## 🎯 Visual Result

### Before:
- Tabs were centered with large gaps
- No visual indicator for active tab
- More spacing between elements

### After:
- ✅ Very compact layout with minimal spacing (`gap-2`)
- ✅ Clear orange underline for active tab
- ✅ Left-aligned with search form
- ✅ More screen real estate for content
- ✅ Modern, clean visual design

## 📱 Layout Details

### Spacing:
- Between tabs: `gap-2` (8px)
- Icon to text: `gap-1` (4px)
- Container padding: `px-4` (16px from edges)

### Active Tab Indicator:
```tsx
{isActive && (
  <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#EF8759] rounded-full transition-all duration-200" />
)}
```

### Tab Dimensions:
- Minimum width: `80px`
- Icon size (active): `28px`
- Icon size (inactive): `26px`
- Underline: Full text width × 2px high

## 🔧 Technical Implementation

```tsx
// Container with minimal spacing
className="flex gap-2 overflow-x-auto no-scrollbar px-4 relative touch-pan-x"

// Individual tab with relative positioning for underline
className="group flex min-w-[80px] flex-col items-center justify-center gap-1 py-2 transition-all duration-200 select-none scroll-snap-align-start relative"

// Orange underline indicator (matches text width)
className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#EF8759] rounded-full transition-all duration-200"
```

## ✨ User Experience
- More compact, modern interface
- Clear visual feedback for current section
- Consistent brand colors
- Smooth animations and transitions
- Better space utilization on mobile screens