import type { AgePolicy } from "@prisma/client";

/** Server/client-safe empty row used while hydrating RouteEditor. */
export function makeEmptyRouteEditorStop(id?: string) {
  return {
    id: id ?? `stop-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    location: null,
    note: "",
    photos: [],
    priceType: "UNKNOWN" as const,
    priceMin: null,
    priceMax: null,
    priceCurrency: "BYN",
    priceNote: "",
  };
}

/** Preserve explicit policy; ordinary `18+` remains a SPECIFIC tag. */
export function mapPersistedRouteAgeToEditorState(input: {
  agePolicy: AgePolicy;
  ageTags: readonly string[];
}) {
  return {
    agePolicy: input.agePolicy,
    ageTags: [...input.ageTags],
  };
}
