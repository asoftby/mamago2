import type { OfferKind } from "@prisma/client";
import type { OfferFormData } from "./types";
import { getDefaultFormData } from "./defaults";

function formKindToApiKind(
  data: OfferFormData
): "VISIT" | "CLASS" | "PARTY" | "EVENT_TICKET" {
  if (data.offerKind === "birthday") return "PARTY";
  if (data.offerKind === "course") {
    return data.durationType === "recurring" ? "CLASS" : "VISIT";
  }
  if (data.offerKind === "service") return "VISIT";
  return "VISIT";
}

function mapCtaToApi(
  cta: OfferFormData["ctaType"]
): "BOOK" | "RESERVE" | "BUY_TICKET" | "SEND_REQUEST" | "VISIT_WEBSITE" {
  const map: Record<
    NonNullable<OfferFormData["ctaType"]>,
    "BOOK" | "RESERVE" | "BUY_TICKET" | "SEND_REQUEST" | "VISIT_WEBSITE"
  > = {
    записаться: "BOOK",
    забронировать: "RESERVE",
    купить_билет: "BUY_TICKET",
    отправить_заявку: "SEND_REQUEST",
    перейти_на_сайт: "VISIT_WEBSITE",
  };
  if (cta && map[cta]) return map[cta];
  return "BOOK";
}

function parsePrice(value: string): number | undefined {
  const n = parseFloat(String(value).replace(",", ".").trim());
  return Number.isFinite(n) ? n : undefined;
}

function ageGroupsToMonths(ageGroups: string[]): {
  ageMinMonths?: number;
  ageMaxMonths?: number;
} {
  if (!ageGroups.length) return {};
  // Best-effort: labels like "0-3" are not parsed here; optional API fields stay unset.
  return {};
}

/** POST /api/business/offers — matches createOfferSchema */
export function buildOfferCreatePayload(
  data: OfferFormData,
  placeId: string,
  opts?: { status?: "DRAFT" | "PENDING" | "PUBLISHED" }
) {
  const pricingMode = data.pricingMode === "multiple" ? "MULTIPLE" : "SINGLE";
  const ages = ageGroupsToMonths(data.ageGroups);

  const base = {
    source: "PLACE" as const,
    selectedPlace: { id: placeId },
    kind: formKindToApiKind(data),
    title: data.title.trim() || "Новое предложение",
    shortDescription: data.shortDescription.trim() || "—",
    description: data.description?.trim() || "",
    ...ages,
    coverImage: data.coverImage ?? undefined,
    pricingMode,
    singlePrice: parsePrice(data.singlePrice),
    singlePriceLabel: data.singlePriceLabel.trim() || undefined,
    pricingOptions: data.pricingOptions.map((o) => ({
      title: o.title.trim(),
      price: parsePrice(o.price) ?? 0,
      oldPrice: o.oldPrice ? parsePrice(o.oldPrice) : undefined,
      description: o.description?.trim() || undefined,
    })),
    ctaType: mapCtaToApi(data.ctaType),
    phone: (data.ctaPhone || data.phone).trim() || undefined,
    website: (data.ctaLink || data.website).trim() || undefined,
    bookingInstructions: data.ctaInstructions.trim() || undefined,
    status: opts?.status ?? "DRAFT",
  };

  return base;
}

/** PATCH /api/business/offers/[id] — matches updateOfferSchema */
export function buildOfferUpdatePayload(
  data: OfferFormData,
  opts?: { status?: "DRAFT" | "PENDING" | "PUBLISHED" }
) {
  const pricingMode = data.pricingMode === "multiple" ? "MULTIPLE" : "SINGLE";
  const ages = ageGroupsToMonths(data.ageGroups);

  const payload: Record<string, unknown> = {
    title: data.title.trim() || "Новое предложение",
    shortDescription: data.shortDescription.trim() || "—",
    description: data.description?.trim() || "",
    ...ages,
    coverImage: data.coverImage ?? undefined,
    pricingMode,
    singlePrice: parsePrice(data.singlePrice),
    singlePriceLabel: data.singlePriceLabel.trim() || undefined,
    pricingOptions: data.pricingOptions.map((o) => ({
      title: o.title.trim(),
      price: parsePrice(o.price) ?? 0,
      oldPrice: o.oldPrice ? parsePrice(o.oldPrice) : undefined,
      description: o.description?.trim() || undefined,
    })),
    ctaType: mapCtaToApi(data.ctaType),
    phone: (data.ctaPhone || data.phone).trim() || undefined,
    website: (data.ctaLink || data.website).trim() || undefined,
    bookingInstructions: data.ctaInstructions.trim() || undefined,
  };

  if (opts?.status) {
    payload.status = opts.status;
  }

  return payload;
}

/** Map Prisma offer row to wizard form (fields stored in DB only). */
export function mapOfferToFormData(offer: {
  kind: OfferKind;
  title: string;
  description: string | null;
  coverImage: string | null;
  priceFrom: number | null;
  priceText: string | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  discoverySignalIds?: string[];
}): OfferFormData {
  const defaults = getDefaultFormData();
  return {
    ...defaults,
    offerKind: offer.kind === "EVENT" ? "course" : "service",
    durationType: offer.kind === "EVENT" ? "single" : null,
    title: offer.title,
    shortDescription: offer.description ?? "",
    description: offer.description ?? "",
    coverImage: offer.coverImage,
    pricingMode: "single",
    singlePrice: offer.priceFrom != null ? String(offer.priceFrom) : "",
    singleCurrency: "BYN",
    singlePriceLabel: offer.priceText ?? "",
    signalIds: offer.discoverySignalIds ?? [],
  };
}
