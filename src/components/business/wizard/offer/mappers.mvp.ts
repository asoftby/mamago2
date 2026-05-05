// Offer Wizard MVP Mappers
// Convert between form data and API payload

import type { OfferFormDataMVP } from "./types.mvp";

/**
 * Build API payload for creating offer (MVP)
 */
export function buildOfferCreatePayloadMVP(
  formData: OfferFormDataMVP,
  placeId: string,
  options?: { status?: "DRAFT" | "PENDING" | "PUBLISHED" }
) {
  // Combine all signals
  const discoverySignalIds = [
    ...formData.activitySignals,
    ...formData.formatSignals,
    ...formData.participationSignals,
    ...formData.intentionSignals,
    ...formData.featureSignals,
  ];
  
  return {
    source: "PLACE",
    selectedPlace: { id: placeId },
    kind: mapOfferKindToDbKind(formData.offerKind),
    title: formData.title,
    shortDescription: formData.description, // API uses shortDescription
    ageMinMonths: formData.ageMinMonths,
    ageMaxMonths: formData.ageMaxMonths,
    coverImage: formData.coverImage,
    gallery: formData.gallery,
    pricingMode: "SINGLE",
    singlePrice: formData.priceFrom?.toString() || "0",
    singlePriceLabel: formData.priceText || null,
    ctaType: mapCTATypeToApi(formData.ctaType),
    phone: formData.ctaPhone || null,
    website: formData.ctaLink || null,
    discoverySignalIds,
    status: options?.status || "DRAFT",
  };
}

/**
 * Build API payload for updating offer (MVP)
 */
export function buildOfferUpdatePayloadMVP(
  formData: OfferFormDataMVP,
  options?: { status?: "DRAFT" | "PENDING" | "PUBLISHED" }
) {
  // Combine all signals
  const discoverySignalIds = [
    ...formData.activitySignals,
    ...formData.formatSignals,
    ...formData.participationSignals,
    ...formData.intentionSignals,
    ...formData.featureSignals,
  ];
  
  const payload: Record<string, any> = {
    kind: mapOfferKindToDbKind(formData.offerKind),
    title: formData.title,
    shortDescription: formData.description,
    ageMinMonths: formData.ageMinMonths,
    ageMaxMonths: formData.ageMaxMonths,
    coverImage: formData.coverImage,
    gallery: formData.gallery,
    pricingMode: "SINGLE",
    singlePrice: formData.priceFrom?.toString() || "0",
    singlePriceLabel: formData.priceText || null,
    ctaType: mapCTATypeToApi(formData.ctaType),
    phone: formData.ctaPhone || null,
    website: formData.ctaLink || null,
    discoverySignalIds,
  };
  
  if (options?.status) {
    payload.status = options.status;
  }
  
  return payload;
}

/**
 * Map offer kind to database kind
 */
function mapOfferKindToDbKind(kind: "course" | "birthday" | "service" | null): string {
  if (!kind) return "VISIT";
  
  const mapping: Record<string, string> = {
    course: "CLASS",
    birthday: "PARTY",
    service: "VISIT",
  };
  
  return mapping[kind] || "VISIT";
}

/**
 * Map CTA type to API format
 */
function mapCTATypeToApi(ctaType: string | null): string {
  if (!ctaType) return "SEND_REQUEST";
  
  const mapping: Record<string, string> = {
    записаться: "BOOK",
    забронировать: "RESERVE",
    купить_билет: "BUY_TICKET",
    отправить_заявку: "SEND_REQUEST",
    перейти_на_сайт: "VISIT_WEBSITE",
  };
  
  return mapping[ctaType] || "SEND_REQUEST";
}

/**
 * Map database kind to offer kind
 */
function mapDbKindToOfferKind(kind: string): "course" | "birthday" | "service" {
  const mapping: Record<string, "course" | "birthday" | "service"> = {
    CLASS: "course",
    PARTY: "birthday",
    VISIT: "service",
  };
  
  return mapping[kind] || "service";
}

/**
 * Map API CTA type to form CTA type
 */
function mapApiCTATypeToForm(ctaType: string): string {
  const mapping: Record<string, string> = {
    BOOK: "записаться",
    RESERVE: "забронировать",
    BUY_TICKET: "купить_билет",
    SEND_REQUEST: "отправить_заявку",
    VISIT_WEBSITE: "перейти_на_сайт",
  };
  
  return mapping[ctaType] || "отправить_заявку";
}

/**
 * Map offer entity to form data (MVP)
 * For edit mode
 */
export function mapOfferToFormDataMVP(offer: any): OfferFormDataMVP {
  // Extract signals by type
  const signals = offer.discoverySignals || [];
  
  const activitySignals = signals
    .filter((s: any) => ["educational", "creative", "active", "calm", "entertainment", "social", "food"].includes(s.slug))
    .map((s: any) => s.slug);
  
  const formatSignals = signals
    .filter((s: any) => ["indoor", "outdoor", "online", "hybrid"].includes(s.slug))
    .map((s: any) => s.slug);
  
  const participationSignals = signals
    .filter((s: any) => ["individual", "group", "family"].includes(s.slug))
    .map((s: any) => s.slug);
  
  const intentionSignals = signals
    .filter((s: any) => ["family-time", "active-time", "relax", "explore", "eat", "walk"].includes(s.slug))
    .map((s: any) => s.slug);
  
  const featureSignals = signals
    .filter((s: any) => ["free", "paid", "booking-required", "age-restricted"].includes(s.slug))
    .map((s: any) => s.slug);
  
  return {
    offerKind: mapDbKindToOfferKind(offer.kind),
    title: offer.title || "",
    description: offer.shortDescription || "",
    placeId: offer.placeId || null,
    ageMinMonths: offer.ageMinMonths || null,
    ageMaxMonths: offer.ageMaxMonths || null,
    activitySignals,
    formatSignals,
    participationSignals,
    intentionSignals,
    featureSignals,
    priceFrom: offer.singlePrice ? parseFloat(offer.singlePrice) : null,
    priceText: offer.singlePriceLabel || "",
    ctaType: mapApiCTATypeToForm(offer.ctaType) as any,
    ctaPhone: offer.phone || "",
    ctaLink: offer.website || "",
    coverImage: offer.coverImage || null,
    gallery: offer.gallery || [],
  };
}
