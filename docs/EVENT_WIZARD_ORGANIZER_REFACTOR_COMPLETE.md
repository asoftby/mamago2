# Event Wizard Organizer Step Refactor - Complete

## Overview
Полностью переработан шаг "Организатор" в Event Wizard для создания role-aware UX и подготовки архитектуры под отдельную сущность Organizer.

## Key Changes

### 1. Убрана confusing UI с переключателем режимов
- ❌ Удалены плитки "Текущий бизнес / Ручной ввод"
- ✅ Создан role-aware интерфейс для разных типов пользователей

### 2. Role-Aware UX

#### For BUSINESS Users:
- **Default State**: Компактная карточка с профилем бизнеса
- **Change Action**: Кнопка "Изменить организатора" открывает selector
- **Selector Options**: 
  - Мой бизнес (auto-populated)
  - Найти организатора (search existing)
  - Создать нового организатора (custom form)

#### For ADMIN/MODERATOR Users:
- **Default State**: Поиск организатора
- **Search Interface**: Поиск существующих + создание новых
- **No Business Default**: Не показывается business-карточка

### 3. Новая архитектура данных

#### Updated EventFormData:
```typescript
// Step 8: Organizer
organizerMode: "business" | "existing" | "custom";
organizerId: string | null; // For existing organizers
organizerName: string;
organizerDescription: string;
organizerPhone: string;
organizerWebsite: string;
organizerLogoUrl: string | null;
```

#### Подготовка под Organizer Entity:
- Создана абстракция для будущей Organizer модели
- Поддержка linked/existing организаторов через organizerId
- Расширенные поля (phone, website, logo)

### 4. Компонентная архитектура

#### Новые компоненты:
- `OrganizerBusinessCard` - карточка бизнеса пользователя
- `OrganizerSelector` - выбор типа организатора
- `OrganizerSearchSelect` - поиск существующих организаторов
- `OrganizerCreateForm` - форма создания нового организатора
- `OrganizerPreviewCard` - превью выбранного организатора

#### Структура файлов:
```
src/components/business/wizard/event/steps/
├── Step8Organizer.tsx (main component)
└── organizer/
    ├── types.ts
    ├── OrganizerBusinessCard.tsx
    ├── OrganizerSelector.tsx
    ├── OrganizerSearchSelect.tsx
    ├── OrganizerCreateForm.tsx
    └── OrganizerPreviewCard.tsx
```

### 5. UI States

#### Business User Flow:
1. **Default**: Business card with "Изменить" button
2. **Selector**: Choose between business/existing/custom
3. **Search**: Find existing organizer (if selected)
4. **Create**: Custom organizer form (if selected)
5. **Preview**: Show selected organizer with edit option

#### Admin/Moderator Flow:
1. **Search**: Default search interface
2. **Create**: Custom organizer form
3. **Preview**: Show selected organizer

### 6. Enhanced Validation

#### New validation rules:
- `organizerName` required (min 2 chars)
- `organizerId` required if mode is "existing"
- Phone format validation (warning)
- Website URL validation (warning)
- Description recommended (warning)

#### Updated validation logic:
```typescript
const isComplete = data.organizerName.trim().length >= 2 && 
  (data.organizerMode !== "existing" || !!data.organizerId);
```

### 7. Integration Changes

#### EventWizard Props:
```typescript
interface EventWizardProps {
  // ... existing props
  userRole?: "BUSINESS_OWNER" | "ADMIN" | "MODERATOR";
  business?: {
    id: string;
    name: string;
    description?: string;
    phone?: string;
    website?: string;
    logoUrl?: string;
  };
}
```

#### Page Updates:
- Updated `/business/events/new/page.tsx` to fetch business data
- Updated `/business/events/[id]/edit/page.tsx` to fetch business data
- Added Prisma queries for business profile

### 8. User Experience Improvements

#### Business Users:
- ✅ No cognitive load about "modes"
- ✅ Auto-populated business data
- ✅ Clear "change" action when needed
- ✅ Streamlined flow

#### Admin/Moderator Users:
- ✅ Direct search interface
- ✅ No irrelevant business options
- ✅ Quick organizer creation
- ✅ Efficient workflow

### 9. Technical Benefits

#### Clean Architecture:
- Separated concerns by user role
- Modular component structure
- Type-safe interfaces
- Extensible for future Organizer entity

#### Maintainability:
- Clear component responsibilities
- Reusable UI components
- Consistent validation patterns
- Well-documented types

#### Future-Ready:
- Prepared for Organizer entity migration
- Support for organizer search API
- Extensible field structure
- Clean data mapping layer

## Migration Notes

### Backward Compatibility:
- Existing `organizerMode` values mapped to new system
- Old "currentBusiness" → "business"
- Old "manual" → "custom"
- No breaking changes to existing data

### Future Enhancements:
1. **Phase 2**: Full Organizer entity with database migration
2. **Search API**: Real organizer search endpoint
3. **Verification**: Organizer verification system
4. **Logo Upload**: Organizer logo management

## Files Changed

### Core Files:
- `src/components/business/wizard/event/types.ts` - Updated organizer fields
- `src/components/business/wizard/event/defaults.ts` - New default values
- `src/components/business/wizard/event/validation.ts` - Enhanced validation
- `src/components/business/wizard/event/eventWizardSteps.config.tsx` - Updated config

### Main Component:
- `src/components/business/wizard/event/steps/Step8Organizer.tsx` - Complete rewrite

### New Components:
- `src/components/business/wizard/event/steps/organizer/types.ts`
- `src/components/business/wizard/event/steps/organizer/OrganizerBusinessCard.tsx`
- `src/components/business/wizard/event/steps/organizer/OrganizerSelector.tsx`
- `src/components/business/wizard/event/steps/organizer/OrganizerSearchSelect.tsx`
- `src/components/business/wizard/event/steps/organizer/OrganizerCreateForm.tsx`
- `src/components/business/wizard/event/steps/organizer/OrganizerPreviewCard.tsx`

### Integration:
- `src/components/business/wizard/event/EventWizard.tsx` - Added role/business props
- `src/app/business/(protected)/events/new/page.tsx` - Business data fetching
- `src/app/business/(protected)/events/[id]/edit/page.tsx` - Business data fetching

## Result

✅ **Production-ready refactor** with clean role-aware UX
✅ **No breaking changes** to existing wizard flow
✅ **Future-ready architecture** for Organizer entity
✅ **Enhanced user experience** for both business and admin users
✅ **Maintainable codebase** with clear component structure

The organizer step now provides an intuitive, role-specific experience while maintaining architectural cleanliness and preparing for future enhancements.