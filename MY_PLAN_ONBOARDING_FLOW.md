# My Plan Onboarding Flow - 3 Steps

## Overview
When a user clicks "Начать планировать" from the My Plan preview (unauthenticated state), they enter a 3-step onboarding flow integrated into the registration form.

## Flow Architecture

### Entry Point
- User sees My Plan preview with benefits
- Clicks "Начать планировать" button
- `MyPlanPreview.onStartOnboarding()` is called
- Opens `DefaultAuthModal` with `withOnboarding={true}`

### Step 1: Authentication (Email + Password)
**Component**: `AuthStepContent`

**Fields**:
- Email input
- Password input (with show/hide toggle)
- Confirm password input (with show/hide toggle)
- Mode toggle: "Войти" / "Регистрация"

**Validation**:
- Email format validation
- Password minimum length (8 characters)
- Password confirmation match
- Duplicate email detection with helpful link to login

**On Submit**:
- Calls `/api/auth/complete-registration` endpoint
- If `withOnboarding=true`, advances to Step 2 (child)
- If `withOnboarding=false`, redirects to next page

### Step 2: Add Child (Name, Birth Month/Year)
**Component**: `ChildStepContent`

**Fields**:
- Child name (text input)
- Birth month (dropdown: January-December)
- Birth year (dropdown: last 18 years)

**Features**:
- Back button to return to Step 1
- Validation: all fields required
- Loading state during submission

**On Submit**:
- Validates all fields are filled
- Advances to Step 3 (interests)

### Step 3: Select Interests
**Component**: `InterestsStepContent`

**Features**:
- Grid of interest buttons (2 columns)
- Multi-select: click to toggle interest
- Visual feedback: selected interests highlighted with orange border
- Check mark icon on selected items

**Actions**:
- "Создать план" button: submits with selected interests
- "Пропустить" button: skips interests, creates child without them
- Back button: returns to Step 2

**On Submit**:
- Creates child profile with:
  - Name (from Step 2)
  - Birth date (from Step 2)
  - System interests (from Step 3, or empty if skipped)
- Calls `/api/children` endpoint
- Redirects to My Plan page
- Calls `onAuthSuccess()` callback
- Triggers `notifyAuthStateChanged()` to update auth state

## UI Components

### OnboardingStepper
- Shows progress: 1 → 2 → 3
- Completed steps show checkmark
- Current step highlighted in orange
- Connecting lines between steps

### Step Navigation
- Forward: Submit button on each step
- Backward: Back button (except Step 1)
- Close: X button in top-right corner

## State Management

**DefaultAuthModal State**:
- `mode`: "login" | "register"
- `step`: "auth" | "child" | "interests"
- `email`, `password`, `confirm`: auth credentials
- `childName`, `childBirthMonth`, `childBirthYear`: child info
- `selectedInterests`: array of interest IDs
- `loading`: submission state
- `error`: error messages

**Reset on Close**:
- All state resets when modal closes
- User can restart flow from beginning

## API Endpoints Used

1. **POST /api/auth/complete-registration**
   - Input: `{ email, password }`
   - Output: User created (or error if duplicate)

2. **POST /api/children**
   - Input: `{ name, birthDate, systemInterests, customInterests }`
   - Output: Child profile created

3. **GET /api/interests** (via `useChildInterests` hook)
   - Fetches available interests for selection

## Integration Points

### MyPlanProvider
- Manages `showAuthModal` state
- Passes `withOnboarding={true}` to DefaultAuthModal
- Handles `onAuthSuccess` callback
- Opens My Plan after successful onboarding

### MyPlanPreview
- Shows benefits and scenario preview
- "Начать планировать" button triggers onboarding
- "Может быть, позже" button closes preview

## Mobile vs Desktop

**Desktop**:
- Dialog modal with rounded corners
- Max width: 440px
- Stepper visible at top
- Scrollable content area

**Mobile**:
- Bottom sheet (Sheet component)
- Full height: 90vh
- Stepper visible at top
- Scrollable content area

## Error Handling

**Auth Step**:
- Invalid email format
- Password too short
- Passwords don't match
- Duplicate email (with link to login)
- Network errors

**Child Step**:
- Missing required fields
- API errors

**Interests Step**:
- API errors during child creation
- Network errors

## Success Flow

1. User registers with email/password
2. User adds child (name, birth date)
3. User selects interests (or skips)
4. Child profile created with interests
5. User logged in automatically
6. Redirected to My Plan page
7. My Plan opens with new child profile

## Files Involved

- `src/components/auth/DefaultAuthModal.tsx` - Main modal component
- `src/components/MyPlanProvider.tsx` - Integration with My Plan
- `src/components/my-plan/MyPlanPreview.tsx` - Entry point
- `src/hooks/useChildInterests.ts` - Interests data
- `src/features/my-plan/hooks/useMyPlan.tsx` - My Plan state

## Status

✅ **COMPLETE** - 3-step onboarding flow is fully implemented and working
