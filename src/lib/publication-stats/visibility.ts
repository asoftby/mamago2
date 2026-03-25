import type { Role } from "@prisma/client";
import type { PublicationStatsSectionId } from "./types";

/** Кто может видеть publication.stats (этап 1: admin + владелец бизнеса). */
export const PUBLICATION_STATS_ALLOWED_ROLES: readonly Role[] = [
  "ADMIN",
  "BUSINESS_OWNER",
] as const;

export function canViewPublicationStats(role: Role | null | undefined): boolean {
  if (!role) return false;
  return (PUBLICATION_STATS_ALLOWED_ROLES as readonly string[]).includes(role);
}

/**
 * Секции, доступные бизнес-владельцу (остальные роли — полный набор в v1).
 * В будущем: ADMIN — все, BUSINESS_OWNER — подмножество.
 */
const ALL_SECTIONS: PublicationStatsSectionId[] = [
  "overview",
  "traffic",
  "engagement",
  "actions",
  "planning",
  "media",
  "conversions",
  "technical",
];

const BUSINESS_OWNER_HIDDEN: PublicationStatsSectionId[] = [];

/** Проверка по строке роли из JSON `/api/auth/me` (без Prisma на клиенте). */
export function canViewPublicationStatsClient(
  role: string | null | undefined
): boolean {
  if (!role) return false;
  return (PUBLICATION_STATS_ALLOWED_ROLES as readonly string[]).includes(role);
}

export function getVisibleSectionsForRole(
  role: Role | null | undefined
): PublicationStatsSectionId[] {
  if (!role || !canViewPublicationStats(role)) return [];
  if (role === "BUSINESS_OWNER") {
    return ALL_SECTIONS.filter((s) => !BUSINESS_OWNER_HIDDEN.includes(s));
  }
  return [...ALL_SECTIONS];
}
