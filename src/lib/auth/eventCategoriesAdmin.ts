import type { Role } from "@prisma/client";

export function canManageEventCategories(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}
