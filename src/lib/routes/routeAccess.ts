import type { Role, RouteStatus, RouteVisibility } from "@prisma/client";

export interface RouteAccessRoute {
  status: RouteStatus;
  visibility: RouteVisibility;
  authorId: string | null;
}

export interface RouteAccessUser {
  id: string;
  role: Role;
}

/**
 * Access gate for the route detail page. Pure — takes the already-resolved
 * user (or `null`) instead of calling `getCurrentUser()` itself, so it can
 * be unit-tested without auth/session plumbing.
 *
 * PUBLISHED + PUBLIC/UNLISTED — visible to everyone (UNLISTED = by link).
 * DRAFT/ARCHIVED or PRIVATE — only the author and admin/moderator (preview).
 */
export function canViewRoute(route: RouteAccessRoute, user: RouteAccessUser | null): boolean {
  if (route.status === "PUBLISHED" && route.visibility !== "PRIVATE") {
    return true;
  }
  if (!user) return false;
  if (user.role === "ADMIN" || user.role === "MODERATOR") return true;
  return route.authorId !== null && route.authorId === user.id;
}
