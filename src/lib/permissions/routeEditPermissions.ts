import type { AuthActor } from "@/lib/auth/safeUser";

/** Same author-or-staff rule as the route editor's server-side gate. */
export function canEditRouteForUser(
  user: AuthActor | null,
  authorId: string | null,
): boolean {
  if (!user) return false;
  return user.role === "ADMIN" || user.role === "MODERATOR" || authorId === user.id;
}
