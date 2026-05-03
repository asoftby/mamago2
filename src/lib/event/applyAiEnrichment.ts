import { DEFAULT_ACTIVITY_FORMAT } from "@/domain/activities/activity-format";
import type { EnrichmentResult } from "@/lib/ai/enrichEvent";
import type { EventFormData } from "@/components/business/wizard/event/types";

export interface ApplyAiEnrichmentOptions {
  manualOverrides?: string[];
}

export interface ApplyAiEnrichmentResult {
  updates: Partial<EventFormData>;
  appliedFields: string[];
}

function hasManualOverride(
  manualOverrides: string[] | undefined,
  field: "format" | "eventFormats" | "interestIds" | "categoryId",
): boolean {
  return Array.isArray(manualOverrides) && manualOverrides.includes(field);
}

export function applyAiEnrichmentToDraft(
  formData: EventFormData,
  enrichment: EnrichmentResult | null,
  options: ApplyAiEnrichmentOptions = {},
): ApplyAiEnrichmentResult {
  if (!enrichment) {
    return { updates: {}, appliedFields: [] };
  }

  const updates: Partial<EventFormData> = {};
  const appliedFields: string[] = [];
  const manualOverrides = options.manualOverrides ?? [];

  if (
    enrichment.suggestedUpdates.format &&
    !hasManualOverride(manualOverrides, "format") &&
    formData.format === DEFAULT_ACTIVITY_FORMAT
  ) {
    updates.format = enrichment.suggestedUpdates.format;
    appliedFields.push("format");
  }

  if (
    enrichment.suggestedUpdates.eventFormats &&
    enrichment.suggestedUpdates.eventFormats.length > 0 &&
    !hasManualOverride(manualOverrides, "eventFormats") &&
    (formData.eventFormats?.length ?? 0) === 0
  ) {
    updates.eventFormats = enrichment.suggestedUpdates.eventFormats;
    appliedFields.push("eventFormats");
  }

  if (
    enrichment.suggestedUpdates.interestIds &&
    enrichment.suggestedUpdates.interestIds.length > 0 &&
    !hasManualOverride(manualOverrides, "interestIds") &&
    (formData.interestIds?.length ?? 0) === 0
  ) {
    updates.interestIds = enrichment.suggestedUpdates.interestIds;
    appliedFields.push("interestIds");
  }

  if (
    enrichment.mainCategory &&
    !hasManualOverride(manualOverrides, "categoryId") &&
    !formData.categoryId
  ) {
    updates.categoryIds = enrichment.suggestedUpdates.categoryIds;
    updates.categoryId = enrichment.suggestedUpdates.categoryId ?? null;
    updates.subcategoryIdsByCategoryId =
      enrichment.suggestedUpdates.subcategoryIdsByCategoryId ?? {};
    updates.subcategoryId = enrichment.suggestedUpdates.subcategoryId ?? null;
    updates.genreSlugByRootCategoryId =
      enrichment.suggestedUpdates.genreSlugByRootCategoryId ?? {};
    if (enrichment.suggestedUpdates.cinemaGenre !== undefined) {
      updates.cinemaGenre = enrichment.suggestedUpdates.cinemaGenre;
    }
    updates.categorySlug = enrichment.suggestedUpdates.categorySlug ?? null;
    updates.categoryPathLabel = enrichment.suggestedUpdates.categoryPathLabel ?? null;
    updates.primaryRootHasChildren =
      enrichment.suggestedUpdates.primaryRootHasChildren ?? false;
    appliedFields.push("categoryId");
  }

  return { updates, appliedFields };
}
