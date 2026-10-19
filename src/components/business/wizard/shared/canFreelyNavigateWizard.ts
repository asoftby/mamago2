import type { Role } from "@prisma/client";

/**
 * Staff can review/edit wizard steps in any order. This is UI navigation only:
 * draft and publication validation must still run independently.
 */
export function canFreelyNavigateWizard(role?: Role | null): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}
