import type { Role } from "@prisma/client";

export function canManageSignalDefinitions(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}
