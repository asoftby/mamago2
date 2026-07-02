import type {
  CanonicalCtaObject,
  CtaSourceEntityType,
} from "@/lib/cta-platform";

export type CtaStepActionChoice = "DISCOVER" | "REQUEST" | "EXTERNAL" | null;
export type CtaStepRequestMode = "SIMPLE" | "CALENDAR" | null;
export type CtaStepCalendarMode = "DATE_ONLY" | "DATE_AND_TIME" | null;
export type CtaStepExternalKind = "SITE" | "TICKETS";
export type CtaStepRequestLabelKind = "BOOK" | "REQUEST";
export type CtaStepLegacyOriginKind = "CTA" | "BOOKING" | null;

export interface CtaStepSourceContext {
  sourceEntityType: CtaSourceEntityType;
  sourceEntityId: string;
}

export interface CtaStepCalendarSlot {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number | null;
}

export interface CtaStepCalendarDay {
  id: string;
  date: string;
  capacity: number | null;
  slots: CtaStepCalendarSlot[];
}

export interface CtaStepFallbackModel {
  phone: string;
  website: string;
}

export interface CtaStepFormValue {
  actionChoice: CtaStepActionChoice;
  requestMode: CtaStepRequestMode;
  calendarMode: CtaStepCalendarMode;
  externalKind: CtaStepExternalKind;
  externalUrl: string;
  instructions: string;
  requestLabelKind: CtaStepRequestLabelKind;
  legacyOrigin: CtaStepLegacyOriginKind;
  fallback: CtaStepFallbackModel;
  calendarDays: CtaStepCalendarDay[];
}

export interface CtaStepDerivedState {
  canonicalCta: CanonicalCtaObject;
  userFacingSummary: string;
  issues: string[];
}
