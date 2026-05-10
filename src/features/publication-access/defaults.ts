import type {
  PublicationAccess,
  PublicationAccessMethod,
  PublicationEntityType,
} from "./types";

export const DEFAULT_ACCESS_METHODS_BY_ENTITY: Record<
  PublicationEntityType,
  PublicationAccessMethod[]
> = {
  event: ["details", "ticket", "timeslots", "prebooking"],
  offer: ["details", "prebooking", "external", "contact"],
  place: ["details", "external", "contact", "prebooking"],
  route: ["details", "ticket", "external", "contact"],
};

export function getDefaultPublicationAccess(
  entityType: PublicationEntityType,
): PublicationAccess {
  const method = DEFAULT_ACCESS_METHODS_BY_ENTITY[entityType][0] ?? "details";
  return { method, timeSlots: [] };
}

