import type { MigrationMediaScope, MigrationTargetType } from "../types";

export const WORDPRESS_SERVICES_POST_TYPE = "services";
export const WORDPRESS_PROGRAMS_POST_TYPE = "hb-programs";

export interface ServicesProgramsOfferMapping {
  sourcePostType: typeof WORDPRESS_SERVICES_POST_TYPE | typeof WORDPRESS_PROGRAMS_POST_TYPE;
  targetType: Extract<MigrationTargetType, "OFFER">;
  mediaScope: Extract<MigrationMediaScope, "OFFER_SERVICES" | "OFFER_PROGRAMS">;
  targetRole: "wordpress-service-offer" | "wordpress-program-offer";
}

export const SERVICES_PROGRAMS_TO_OFFER_MAPPINGS = [
  {
    sourcePostType: WORDPRESS_SERVICES_POST_TYPE,
    targetType: "OFFER",
    mediaScope: "OFFER_SERVICES",
    targetRole: "wordpress-service-offer",
  },
  {
    sourcePostType: WORDPRESS_PROGRAMS_POST_TYPE,
    targetType: "OFFER",
    mediaScope: "OFFER_PROGRAMS",
    targetRole: "wordpress-program-offer",
  },
] as const satisfies readonly ServicesProgramsOfferMapping[];

export function getServicesProgramsOfferMapping(
  sourcePostType: string,
): ServicesProgramsOfferMapping | null {
  return (
    SERVICES_PROGRAMS_TO_OFFER_MAPPINGS.find(
      (mapping) => mapping.sourcePostType === sourcePostType,
    ) ?? null
  );
}
