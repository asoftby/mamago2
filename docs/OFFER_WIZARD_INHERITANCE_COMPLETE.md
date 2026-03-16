# Offer Wizard Event Architecture Inheritance - Complete

## Overview
Successfully inherited Event Wizard architecture 1-to-1 for Offer Wizard, following user requirements to NOT design from scratch but reuse existing patterns.

## Architecture Inheritance

### Core Files Inherited
- **OfferWizard.tsx** - Main wizard component (copied from EventWizard.tsx)
- **offerWizardSteps.config.tsx** - Step configuration (copied from eventWizardSteps.config.tsx)
- **types.ts** - Form data types (adapted from Event types)
- **defaults.ts** - Default values and utilities (adapted from Event defaults)
- **validation.ts** - Step validation logic (adapted from Event validation)

### Step Components (8 + 1 Review)
1. **Step1Source** - Choose place or event as source (replaces Event Basics)
2. **Step2Type** - Select offer type: visit/class/party/event_ticket (replaces Event Location)
3. **Step3Information** - Title, description, age groups (replaces Event Description)
4. **Step4Media** - Cover image and gallery (same as Event Media)
5. **Step5Conditions** - Format-specific conditions (replaces Event Schedule)
6. **Step6Pricing** - Single or multiple pricing options (replaces Event Pricing)
7. **Step7Contacts** - Phone, website, social links (same as Event Contacts)
8. **Step8Publication** - CTA type and publication settings (replaces Event Organizer)
9. **Step9Review** - Complete review with validation (same as Event Review)

## Key Features Inherited

### 1. Wizard Shell & Navigation
- ✅ Same header pattern with progress bar
- ✅ Same step navigation buttons (Назад/Далее)
- ✅ Same review step with save/submit actions
- ✅ Same sticky header with step progress

### 2. Form Management
- ✅ Same autosave with localStorage
- ✅ Same draft/submit validation flow
- ✅ Same form data update patterns
- ✅ Same wizard session management

### 3. Step Configuration System
- ✅ Config-driven step rendering
- ✅ Same completion validation per step
- ✅ Same summary generation for review
- ✅ Same missing fields detection

### 4. Validation Architecture
- ✅ Step-by-step validation
- ✅ Draft vs submit validation levels
- ✅ Same error/warning patterns
- ✅ Same validation result structure

### 5. Review Step Pattern
- ✅ Auto-generated review sections
- ✅ Completion percentage calculation
- ✅ Missing fields chip display
- ✅ Edit buttons for each section

## Domain-Specific Adaptations

### Offer-Specific Fields
- **Source Selection**: Place or Event as base
- **Offer Types**: Visit, Class, Party, Event Ticket
- **Auto-Intent**: Automatically determines catalog placement
- **Pricing Modes**: Single price or multiple options
- **CTA Types**: Записаться, Забронировать, Купить билет, etc.

### Business Logic
- **Intent Auto-Determination**: Based on source + offer type
- **CTA Auto-Suggestion**: Based on offer type
- **Conditional Fields**: Different fields per offer type
- **Validation Rules**: Adapted for offer-specific requirements

## Pages Updated
- ✅ `/business/offers/new` - Uses new OfferWizard with create mode
- ✅ `/business/offers/[id]/edit` - Uses new OfferWizard with edit mode

## Technical Implementation

### Same Patterns as Event Wizard
- Config-driven step system
- Shared wizard types from `../shared/types.ts`
- Same component prop interfaces
- Same navigation and progress logic
- Same autosave and session management
- Same validation and review patterns

### Offer-Specific Customizations
- 8 content steps + 1 review step (vs Event's 8 + 1)
- Offer-specific form data structure
- Domain-specific validation rules
- Offer-specific step components
- Auto-determination of intent and CTA

## Result
The Offer Wizard now feels like the same product constructor as Event Wizard, with identical UX patterns, navigation, validation, and review systems. Only the domain-specific fields and business logic have been adapted for offers.

## Next Steps (TODOs in code)
1. Add `mapOfferToFormData` function for edit mode
2. Add `buildOfferPayload` function for API calls
3. Implement actual API endpoints for offers
4. Add proper ownership verification in edit page
5. Connect to real Places/Events data in Step1Source
6. Add proper media upload integration

The architecture is complete and ready for these implementation details.