# Add Persona Type Modal Implementation ✅

## Overview
Created "Кого добавить?" modal that allows users to choose between adding a child or an adult when clicking the "+" button in the audience chip row.

## What Was Created

### 1. AddPersonaTypeModal Component ✅
**Location**: `src/features/my-plan/components/AddPersonaTypeModal.tsx`

**Features**:
- Modal/Sheet with title "Кого добавить?"
- Two options: "Ребёнок" and "Взрослый"
- Each option has icon, title, and description
- Responsive (Sheet on mobile, Dialog on desktop)
- Close button in header
- Cancel button in footer

**Structure**:
```tsx
<AddPersonaTypeModal
  open={boolean}
  onOpenChange={(open) => void}
  onSelectChild={() => void}
  onSelectAdult={() => void}
  layout="default" | "desktop"
/>
```

**Options**:
1. **Ребёнок**
   - Icon: Baby (orange)
   - Description: "Укажем возраст и интересы"
   - Action: Opens QuickAddChildModal

2. **Взрослый**
   - Icon: User (orange)
   - Description: "Настроим предпочтения"
   - Action: Opens QuickAddAdultModal

### 2. QuickAddAdultModal Component ✅
**Location**: `src/components/adults/QuickAddAdultModal.tsx`

**Features**:
- Simple form with name field only
- POST to `/api/adults` endpoint
- Success callback with adult ID
- Notifies family personas changed
- Refreshes router

**Fields**:
- Name (required, text input)

**API Body**:
```json
{
  "displayName": "string",
  "preferences": []
}
```

### 3. Integration in PlanMainContent ✅

**State Added**:
```typescript
const [showAddPersonaTypeModal, setShowAddPersonaTypeModal] = useState(false);
const [showAddAdultModal, setShowAddAdultModal] = useState(false);
```

**Flow**:
1. User clicks "+" button in chip row
2. Opens AddPersonaTypeModal
3. User selects "Ребёнок" or "Взрослый"
4. AddPersonaTypeModal closes
5. Opens QuickAddChildModal or QuickAddAdultModal
6. User fills form and saves
7. Success toast shown
8. Family personas refreshed

## Visual Design

### Modal Layout
```
┌─────────────────────────────────────┐
│ Кого добавить?                  [X] │
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [👶] Ребёнок                    │ │
│ │      Укажем возраст и интересы  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [👤] Взрослый                   │ │
│ │      Настроим предпочтения      │ │
│ └─────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│           [ Отмена ]                │
└─────────────────────────────────────┘
```

### Styling
- Icon container: `bg-[#EF8759]/10` with orange icon
- Options: Rounded cards with border
- Hover: Border darkens, background lightens
- Full-width clickable areas

## Files Created

1. `src/features/my-plan/components/AddPersonaTypeModal.tsx` (new)
2. `src/components/adults/QuickAddAdultModal.tsx` (new)

## Files Modified

1. `src/features/my-plan/components/PlanMainContent.tsx`
   - Added imports for new modals
   - Added state for modals
   - Changed "+" button to open AddPersonaTypeModal
   - Added modal components to both desktop and mobile layouts

## User Flow

### Before
```
Click "+" → Opens QuickAddChildModal directly
```

### After
```
Click "+" 
  → Opens AddPersonaTypeModal
    → Click "Ребёнок" → Opens QuickAddChildModal
    → Click "Взрослый" → Opens QuickAddAdultModal
```

## Benefits

### User Experience
- **Clear choice**: User explicitly chooses persona type
- **Discoverable**: Both options visible upfront
- **Consistent**: Matches design pattern from screenshot
- **Flexible**: Easy to add more persona types later

### Technical
- **Modular**: Separate modal for type selection
- **Reusable**: AddPersonaTypeModal can be used elsewhere
- **Type-safe**: Proper TypeScript interfaces
- **Maintainable**: Clear separation of concerns

## API Endpoints

### POST /api/adults
**Request**:
```json
{
  "displayName": "string",
  "preferences": []
}
```

**Response**:
```json
{
  "adult": {
    "id": "string",
    ...
  }
}
```

### POST /api/children
**Request**:
```json
{
  "name": "string",
  "birthDate": "ISO string",
  "systemInterests": [],
  "customInterests": []
}
```

**Response**:
```json
{
  "child": {
    "id": "string",
    ...
  }
}
```

## Edge Cases Handled

### Modal Stacking
- AddPersonaTypeModal closes before opening child/adult modal
- No double overlays
- Clean transitions

### Cancel Behavior
- Cancel button closes modal
- X button closes modal
- Click outside closes modal (desktop)
- Swipe down closes sheet (mobile)

### Success Flow
- Success toast shown
- Family personas refreshed
- Router refreshed
- Chip row updates automatically

## Acceptance Criteria

- [x] "+" button opens "Кого добавить?" modal
- [x] Modal shows two options: "Ребёнок" and "Взрослый"
- [x] Each option has icon and description
- [x] Clicking "Ребёнок" opens QuickAddChildModal
- [x] Clicking "Взрослый" opens QuickAddAdultModal
- [x] Modal closes before opening next modal
- [x] Success toasts shown after adding
- [x] Family personas refresh after adding
- [x] Works on both desktop and mobile
- [x] Responsive design (Sheet on mobile, Dialog on desktop)

---

**Status**: Implementation complete, ready for testing
**Date**: 2026-04-04
**Task**: Add Persona Type Modal Implementation
