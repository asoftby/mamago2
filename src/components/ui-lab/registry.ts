/**
 * UI Lab Component Registry
 * Central registry for component metadata
 * 
 * This is a manual registry for MVP. Can be extended with automated
 * AST analysis in the future.
 */

import type { ComponentUsageMeta } from "./types";

/**
 * Public UI Lab Components
 * Components from /ui-lab
 */
export const UI_LAB_REGISTRY: Record<string, ComponentUsageMeta> = {
  "plan-card": {
    title: "PlanCard",
    sourcePath: "src/features/me/components/PlanCard.tsx",
    status: "rendered",
    usedIn: [
      "src/app/(public)/me/page.tsx",
      "src/app/(public)/me/day/[date]/page.tsx",
      "src/app/(ui)/ui-lab/_sections/PlanCardSection.tsx",
    ],
    description: "User's daily plan card with activities",
  },
  
  "children-card": {
    title: "ChildrenCard",
    sourcePath: "src/features/me/components/ChildrenCard.tsx",
    status: "rendered",
    usedIn: [
      "src/app/(public)/me/profile/page.tsx",
      "src/app/(ui)/ui-lab/_sections/ChildrenCardSection.tsx",
    ],
    description: "User's children profile card",
  },
  
  "save-to-plan-modal": {
    title: "SaveToPlanModal",
    sourcePath: "src/components/activity/SaveToPlanModal.tsx",
    status: "rendered",
    usedIn: [
      "src/features/save/SaveHeart.tsx",
      "src/features/save/ArticleSaveHeart.tsx",
      "src/features/save/PlaceSaveHeart.tsx",
      "src/components/activity/SaveActivityFlowAdaptive.tsx",
      "src/app/(ui)/ui-lab/_sections/SaveModalSection.tsx",
    ],
    description: "Modal for saving activities/articles/places to user's plan or ideas",
  },
  
  "opening-hours-preview": {
    title: "OpeningHoursPreview",
    sourcePath: "src/components/openingHours/OpeningHoursPreview.tsx",
    status: "rendered",
    usedIn: [
      "src/app/(public)/places/[slug]/page.tsx",
      "src/app/(ui)/ui-lab/_sections/OpeningHoursSection.tsx",
    ],
    description: "Display component for place opening hours",
  },
  
  "date-time-picker": {
    title: "DateTimePicker",
    sourcePath: "src/components/ui/date-time-picker.tsx",
    status: "rendered",
    usedIn: [
      "src/app/(ui)/ui-lab/_sections/DateTimePickerSection.tsx",
      "src/features/save/ScheduleModal.tsx",
    ],
    description: "Combined date and time picker component",
  },
  
  "calendar": {
    title: "Calendar",
    sourcePath: "src/components/ui/calendar.tsx",
    status: "rendered",
    usedIn: [
      "src/components/admin/event-schedule/EventScheduleCard.tsx",
    ],
    description: "Clean premium calendar for date selection",
  },

  chip: {
    title: "Chip",
    sourcePath: "src/components/ui/Chip.tsx",
    status: "rendered",
    usedIn: [
      "src/app/(ui)/ui-lab/_sections/UiPrimitivesSection.tsx",
      "src/components/business/wizard/event/steps/Step1Basics.tsx",
    ],
    description: "Pill toggle for single-choice filters and form fields",
  },

  "chips-row": {
    title: "ChipsRow",
    sourcePath: "src/components/ui/chips-row.tsx",
    status: "rendered",
    usedIn: [
      "src/app/(ui)/ui-lab/_sections/UiPrimitivesSection.tsx",
      "src/components/business/wizard/event/steps/Step1Basics.tsx",
      "src/components/business/wizard/offer/steps/Step2Information.tsx",
      "src/components/business/wizard/place/steps/Step1Profile.tsx",
    ],
    description: "Horizontal or wrapping row of multi-select chip buttons",
  },
};

/**
 * Admin UI Lab Components
 * Components from /ui-lab-admin
 */
export const ADMIN_LAB_REGISTRY: Record<string, ComponentUsageMeta> = {
  "event-schedule-module": {
    title: "Event Schedule Module",
    sourcePath: "src/components/admin/event-schedule/EventScheduleList.tsx",
    status: "rendered",
    usedIn: [
      "src/app/(ui)/ui-lab-admin/_sections/EventScheduleSection.tsx",
    ],
    description: "Event date and time scheduling module with recurring support",
  },
  
  "media-metadata-editor": {
    title: "MediaMetadataEditorLayout",
    sourcePath: "src/components/admin/media/MediaMetadataEditorLayout.tsx",
    status: "rendered",
    usedIn: [
      "src/app/admin/media/[id]/page.tsx",
    ],
    description: "Admin layout for editing media metadata",
  },
  
  "place-moderation-view": {
    title: "PlaceModerationView",
    sourcePath: "src/components/admin/PlaceModerationView.tsx",
    status: "rendered",
    usedIn: [
      "src/app/admin/content/places/[id]/page.tsx",
    ],
    description: "Admin interface for moderating place submissions",
  },
  
  "place-revision-moderation-view": {
    title: "PlaceRevisionModerationView",
    sourcePath: "src/components/admin/PlaceRevisionModerationView.tsx",
    status: "rendered",
    usedIn: [
      "src/app/admin/content/places/[id]/page.tsx",
    ],
    description: "Admin interface for moderating place revision requests",
  },
  
  "user-moderation-form": {
    title: "UserModerationForm",
    sourcePath: "src/components/admin/users/UserModerationForm.tsx",
    status: "rendered",
    usedIn: [
      "src/app/admin/users/[id]/UserDetailsClient.tsx",
    ],
    description: "Form for moderating user accounts",
  },
  
  "business-verification-side-panel": {
    title: "BusinessVerificationSidePanel",
    sourcePath: "src/app/admin/b2b/requests/BusinessVerificationSidePanel.tsx",
    status: "rendered",
    usedIn: [
      "src/app/admin/b2b/requests/BusinessVerificationRequestsPage.tsx",
    ],
    description: "Side panel for reviewing business verification requests",
  },
  
  "transaction-details-drawer": {
    title: "TransactionDetailsDrawer",
    sourcePath: "src/components/admin/billing/TransactionDetailsDrawer.tsx",
    status: "rendered",
    usedIn: [
      "src/app/admin/billing/transactions/page.tsx",
    ],
    description: "Drawer for viewing transaction details",
  },
  
  "admin-billing-actions": {
    title: "AdminBillingActions",
    sourcePath: "src/components/admin/billing/AdminBillingActions.tsx",
    status: "rendered",
    usedIn: [
      "src/app/admin/businesses/[id]/billing/page.tsx",
    ],
    description: "Admin actions for billing management (refunds, adjustments)",
  },
  
  "booking-module": {
    title: "Booking / Sales Module",
    sourcePath: "src/components/booking/BookingCard.tsx",
    status: "rendered",
    usedIn: [
      "src/app/(ui)/ui-lab-admin/_sections/BookingModuleSection.tsx",
    ],
    description: "Unified booking and sales interface for events, courses, and services",
  },
  
  "schedule-editor": {
    title: "Schedule Editor",
    sourcePath: "src/components/schedule-editor/ScheduleEditor.tsx",
    status: "rendered",
    usedIn: [
      "src/app/(ui)/ui-lab-admin/_sections/ScheduleEditorSection.tsx",
      "src/components/activity-builder/ActivityForm.tsx",
    ],
    description: "UX-first schedule constructor for dates and time slots management",
  },
  
  "activity-form-builder": {
    title: "Activity Form Builder",
    sourcePath: "src/components/activity-builder/ActivityForm.tsx",
    status: "rendered",
    usedIn: [
      "src/app/(ui)/ui-lab-admin/_sections/ActivityFormBuilderSection.tsx",
    ],
    description: "Unified activity form architecture for events, courses, services, and offers",
  },
};

/**
 * Get component metadata by key
 */
export function getComponentMeta(
  key: string,
  registry: "ui-lab" | "admin"
): ComponentUsageMeta | undefined {
  const source = registry === "ui-lab" ? UI_LAB_REGISTRY : ADMIN_LAB_REGISTRY;
  return source[key];
}

/**
 * Get all components from a registry
 */
export function getAllComponents(
  registry: "ui-lab" | "admin"
): ComponentUsageMeta[] {
  const source = registry === "ui-lab" ? UI_LAB_REGISTRY : ADMIN_LAB_REGISTRY;
  return Object.values(source);
}
