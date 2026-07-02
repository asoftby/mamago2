import type {
  CanonicalCtaObject,
  CanonicalCtaSeed,
  CtaExecutionKind,
  CtaPresentationHint,
} from "./types";

function deriveExecutionKind(seed: CanonicalCtaSeed): CtaExecutionKind {
  if (seed.executionKind) return seed.executionKind;
  if (seed.actionKind === "REQUEST") return "BOOKING_REQUEST";
  if (seed.actionKind === "EXTERNAL") {
    if (seed.externalTarget?.channel === "PHONE") return "EXTERNAL_PHONE";
    if (seed.externalTarget) return "EXTERNAL_URL";
    if (seed.contactFallback?.length) return "EXTERNAL_CONTACT";
  }
  return "NONE";
}

function derivePrimaryLabel(seed: CanonicalCtaSeed): string {
  if (seed.primaryLabel?.trim()) return seed.primaryLabel.trim();

  if (seed.actionKind === "REQUEST") {
    if (seed.requestConfig?.selectionMode === "SLOT") return "Выбрать время";
    if (seed.requestConfig?.selectionMode === "DATE") return "Выбрать дату";
    return "Оставить заявку";
  }

  if (seed.actionKind === "EXTERNAL") {
    if (seed.externalTarget?.channel === "PHONE") return "Позвонить";
    return "Перейти";
  }

  return "Подробнее";
}

function derivePresentationHints(seed: CanonicalCtaSeed): CtaPresentationHint[] | undefined {
  const hints = new Set<CtaPresentationHint>(seed.presentationHints ?? []);

  if (seed.instructions?.trim()) hints.add("HAS_INSTRUCTIONS");
  if (seed.contactFallback && seed.contactFallback.length > 0) {
    hints.add("USES_CONTACT_FALLBACK");
  }
  if (seed.requestConfig?.selectionMode === "DATE") {
    hints.add("REQUIRES_DATE_SELECTION");
  }
  if (seed.requestConfig?.selectionMode === "SLOT") {
    hints.add("REQUIRES_SLOT_SELECTION");
  }

  return hints.size > 0 ? Array.from(hints) : undefined;
}

export function createCanonicalCta(seed: CanonicalCtaSeed): CanonicalCtaObject {
  return {
    actionKind: seed.actionKind,
    executionKind: deriveExecutionKind(seed),
    availability: seed.availability ?? "AVAILABLE",
    primaryLabel: derivePrimaryLabel(seed),
    sourceEntityType: seed.sourceEntityType,
    sourceEntityId: seed.sourceEntityId,
    instructions: seed.instructions?.trim() || undefined,
    externalTarget: seed.externalTarget,
    requestConfig: seed.requestConfig,
    contactFallback: seed.contactFallback?.length ? seed.contactFallback : undefined,
    secondaryAction: seed.secondaryAction,
    availabilityReason: seed.availabilityReason?.trim() || undefined,
    presentationHints: derivePresentationHints(seed),
  };
}
