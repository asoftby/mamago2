export const CTA_ACTION_KINDS = ["DISCOVER", "REQUEST", "EXTERNAL"] as const;

export type CtaActionKind = (typeof CTA_ACTION_KINDS)[number];

export const CTA_EXECUTION_KINDS = [
  "NONE",
  "BOOKING_REQUEST",
  "EXTERNAL_URL",
  "EXTERNAL_PHONE",
  "EXTERNAL_CONTACT",
] as const;

export type CtaExecutionKind = (typeof CTA_EXECUTION_KINDS)[number];

export type CtaAvailability = "AVAILABLE" | "UNAVAILABLE";

export type CtaSourceEntityType =
  | "EVENT"
  | "OFFER"
  | "PLACE"
  | "CAMP"
  | "ROUTE"
  | (string & {});

export type CtaContactChannel =
  | "PHONE"
  | "EMAIL"
  | "TELEGRAM"
  | "WHATSAPP"
  | "VIBER"
  | "URL";

export interface CtaContactFallback {
  channel: CtaContactChannel;
  value: string;
  href: string;
  label?: string;
}

export interface CtaExternalTarget {
  channel: CtaContactChannel;
  value: string;
  href: string;
  openInNewTab?: boolean;
}

export interface CtaRequestConfig {
  runtime: "BOOKING";
  selectionMode: "NONE" | "DATE" | "SLOT";
}

export interface CtaSecondaryAction {
  kind: "DISCOVER" | "EXTERNAL" | "CONTACT";
  label: string;
  target?: CtaExternalTarget;
}

export type CtaPresentationHint =
  | "HAS_INSTRUCTIONS"
  | "USES_CONTACT_FALLBACK"
  | "REQUIRES_DATE_SELECTION"
  | "REQUIRES_SLOT_SELECTION";

export interface CanonicalCtaObject {
  actionKind: CtaActionKind;
  executionKind: CtaExecutionKind;
  availability: CtaAvailability;
  primaryLabel: string;
  sourceEntityType: CtaSourceEntityType;
  sourceEntityId: string;
  instructions?: string;
  externalTarget?: CtaExternalTarget;
  requestConfig?: CtaRequestConfig;
  contactFallback?: CtaContactFallback[];
  secondaryAction?: CtaSecondaryAction;
  availabilityReason?: string;
  presentationHints?: CtaPresentationHint[];
}

export interface CanonicalCtaSeed {
  actionKind: CtaActionKind;
  sourceEntityType: CtaSourceEntityType;
  sourceEntityId: string;
  executionKind?: CtaExecutionKind;
  availability?: CtaAvailability;
  primaryLabel?: string;
  instructions?: string;
  externalTarget?: CtaExternalTarget;
  requestConfig?: CtaRequestConfig;
  contactFallback?: CtaContactFallback[];
  secondaryAction?: CtaSecondaryAction;
  availabilityReason?: string;
  presentationHints?: CtaPresentationHint[];
}
