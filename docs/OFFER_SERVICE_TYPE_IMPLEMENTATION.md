# Offer Service Type Implementation

## Overview

Successfully extended the Offer Wizard to support a new SERVICE offer type while maintaining the existing Event Wizard flow 1:1. The implementation adds support for service-based businesses like cake makers, decorators, photographers, animators, and other birthday-related services.

## Changes Made

### 1. Extended Type System

**File: `src/components/business/wizard/offer/types.ts`**
- Added `"service"` to `offerKind` union type
- Added service-specific fields:
  - `serviceType`: Category of service (торт, декор, фотограф, etc.)
  - `locationType`: Where service is provided (client_location, place, remote)
  - `serviceDescription`: Detailed service description
  - `serviceDuration`: How long the service takes
  - `serviceDeliveryArea`: Geographic coverage area

### 2. Updated Step 1: Offer Type Selection

**File: `src/components/business/wizard/offer/steps/Step1Type.tsx`**
- Added SERVICE card with Wrench icon
- Title: "Услуга"
- Description: "Торт, декор, фотограф, аниматор и другие услуги"
- Added service type selection (9 categories)
- Added location type selection (3 options)

### 3. Extended Step 4: Format and Conditions

**File: `src/components/business/wizard/offer/steps/Step4Conditions.tsx`**
- Added `renderServiceFields()` function
- Service-specific form fields:
  - Service description (required)
  - Duration (optional)
  - Delivery area (optional)

### 4. Updated Validation Logic

**File: `src/components/business/wizard/offer/validation.ts`**
- Added SERVICE validation in Step 1 (requires serviceType and locationType)
- Added SERVICE validation in Step 4 (requires serviceDescription)
- Updated completion checks for all validation functions

### 5. Enhanced Step Configuration

**File: `src/components/business/wizard/offer/offerWizardSteps.config.tsx`**
- Added SERVICE to kind labels mapping
- Added service type and location type labels
- Updated summary generation for SERVICE offers
- Updated missing fields detection

### 6. Updated Default Values and Logic

**File: `src/components/business/wizard/offer/defaults.ts`**
- Added default values for new SERVICE fields
- Updated `determineIntent()`: SERVICE → "день_рождения"
- Updated `suggestCTAType()`: SERVICE → "отправить_заявку"

## Service Categories

The following service types are supported:

1. **Торт** - Custom cakes
2. **Декор** - Decoration services
3. **Фотограф** - Photography services
4. **Аниматор** - Entertainment/animation
5. **Шоу** - Show programs
6. **Аквагрим** - Face painting
7. **Ведущий** - Event hosting
8. **Мастер-класс на выезд** - Mobile workshops
9. **Другое** - Other services

## Location Types

Services can be provided in three ways:

1. **У клиента** (CLIENT_LOCATION) - Service delivered to client's location
2. **В локации** (PLACE) - Service provided at a specific venue
3. **Онлайн / удаленно** (REMOTE) - Remote/online service delivery

## Catalog Placement Logic

All SERVICE offers are automatically placed in the "День рождения" (Birthday) catalog section, as they are primarily birthday-related services.

## Compatibility

- ✅ Maintains Event Wizard flow 1:1
- ✅ Same step shell and navigation
- ✅ Same validation approach
- ✅ Same moderation flow
- ✅ Compatible with existing pricing system
- ✅ Supports draft functionality
- ✅ Works with existing CTA types

## Database Schema

The implementation leverages the existing Prisma schema which already includes:
- `OfferKind` enum with `SERVICE` value
- `Offer` model with flexible fields

No database migrations are required as the schema already supports SERVICE offers.

## Usage Example

1. User selects "Услуга" in Step 1
2. Chooses service type (e.g., "Торт")
3. Selects location type (e.g., "У клиента")
4. Fills in service description in Step 4
5. Completes pricing, contacts, and CTA steps
6. Offer is automatically categorized under "День рождения"

## Testing

The implementation maintains backward compatibility and doesn't break existing VISIT, CLASS, or PARTY offer types. All validation and step logic properly handles the new SERVICE type alongside existing types.