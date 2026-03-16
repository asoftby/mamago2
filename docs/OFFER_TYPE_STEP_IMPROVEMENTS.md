# Offer Type Step Improvements

## Overview

Improved the "Offer Type" step in the Offer Wizard to make selection clearer for businesses and moderators while keeping the model simple and avoiding additional complexity.

## Changes Made

### 1. Updated Offer Type Names

**Before:**
- `visit` → Посещение места
- `class` → Занятие / курс  
- `party` → Детский праздник
- `service` → Услуга

**After:**
- `event` → Событие или активность
- `course` → Курс / занятия
- `birthday` → Детский праздник
- `service` → Услуга

### 2. Improved Card Content

**Updated titles and descriptions:**

1. **Событие или активность**
   - Description: "Разовое мероприятие, мастер-класс, спектакль или посещение"
   - Icon: Calendar
   - Maps to: EVENT

2. **Курс / занятия**
   - Description: "Регулярные занятия и секции для детей"
   - Icon: GraduationCap
   - Maps to: COURSE

3. **Детский праздник**
   - Description: "Организация дня рождения и праздничных программ"
   - Icon: PartyPopper
   - Maps to: BIRTHDAY

4. **Услуга**
   - Description: "Торт, декор, фотограф, аниматор и другие услуги"
   - Icon: Wrench
   - Maps to: SERVICE

### 3. Enhanced Card UX

**Visual improvements:**
- Added hover effects with subtle elevation (`hover:shadow-md`)
- Updated selected state with brand color (#EF8759)
- Improved icon coloring (gray when unselected, brand color when selected)
- Enhanced transition animations (`transition-all duration-200`)
- Better border highlighting for selected cards

### 4. Added Helper Section

**New helper section below cards:**
- Title: "Не уверены что выбрать?"
- Subtitle: "Напишите что вы предлагаете"
- Input placeholder: "Например: мастер-класс, курс, торт, аниматор"
- Styled with gray background and white input field
- Helper text is stored in local state but doesn't affect form data

### 5. Updated All Related Files

**Files updated to use new offer kind names:**
- `types.ts` - Updated OfferFormData interface
- `defaults.ts` - Updated intent determination and CTA suggestion logic
- `validation.ts` - Updated all validation functions
- `Step4Conditions.tsx` - Updated conditional rendering
- `offerWizardSteps.config.tsx` - Updated step configuration and labels

### 6. Maintained Data Model Compatibility

**No breaking changes:**
- Same four offer types (just renamed)
- Same validation logic structure
- Same wizard flow and architecture
- Same step configuration pattern
- Compatible with existing Prisma schema

## UX Improvements

### Reduced Cognitive Load
- Clearer, more descriptive titles
- Better examples in descriptions
- Helper section for uncertain users
- Consistent visual hierarchy

### Better Business Understanding
- "Событие или активность" is clearer than "Посещение места"
- "Курс / занятия" is more familiar than "Занятие / курс"
- Added specific examples in descriptions
- Helper input provides guidance without complexity

### Enhanced Visual Design
- Brand color integration (#EF8759)
- Smooth hover animations
- Clear selected state indication
- Professional card styling
- Consistent with mamaGo design system

## Technical Implementation

### Type Safety
- All TypeScript types updated consistently
- Proper union type definitions
- Maintained type safety across all files

### Validation Logic
- Updated all validation functions
- Maintained same validation rules
- Consistent error messages

### Step Configuration
- Updated summary generation
- Updated missing fields detection
- Maintained same completion logic

## Result

The improved step provides:
- ✅ Clearer selection for businesses
- ✅ Reduced decision friction
- ✅ Better prevention of wrong type selections
- ✅ Simple system architecture
- ✅ Professional mamaGo design consistency
- ✅ Helpful guidance without complexity

The changes maintain full backward compatibility while significantly improving the user experience for business users creating offers.