import type {
  Offer,
  OfferPlacementKey,
  OfferProductType,
} from "@prisma/client";

const ALL_PLACEMENT_KEYS: OfferPlacementKey[] = [
  "WHERE_TO_GO",
  "CLASSES",
  "CAMPS",
  "BIRTHDAY",
];

export function normalizePlacementKeys(
  keys: readonly string[] | null | undefined,
): OfferPlacementKey[] {
  if (!Array.isArray(keys)) return [];
  return ALL_PLACEMENT_KEYS.filter((key) => keys.includes(key));
}

export function inferOfferProductType(params: {
  productType?: OfferProductType | null;
  campProgramType?: string | null;
  kind?: Offer["kind"] | null;
}): OfferProductType {
  if (params.productType) return params.productType;
  if (params.campProgramType) return "CAMP";
  if (params.kind === "EVENT") return "ONE_TIME_ACTIVITY";
  return "PLACE_VISIT";
}

export function inferRequestedPlacements(params: {
  productType: OfferProductType;
  requestedPlacements?: readonly string[] | null;
}): OfferPlacementKey[] {
  const normalized = normalizePlacementKeys(params.requestedPlacements);
  if (normalized.length > 0) return normalized;

  switch (params.productType) {
    case "CAMP":
      return ["CAMPS"];
    case "REGULAR_ACTIVITY":
      return ["CLASSES"];
    case "ONE_TIME_ACTIVITY":
      return ["WHERE_TO_GO"];
    default:
      return [];
  }
}

export function mapProductTypeToLegacyKind(
  productType: OfferProductType,
): Offer["kind"] {
  return productType === "ONE_TIME_ACTIVITY" ? "EVENT" : "SERVICE";
}

export function hasApprovedPlacement(
  offer: {
    placements?: Array<{ key: OfferPlacementKey; status: string }> | null;
  },
  key: OfferPlacementKey,
): boolean {
  return (
    offer.placements?.some(
      (placement) => placement.key === key && placement.status === "APPROVED",
    ) ?? false
  );
}
