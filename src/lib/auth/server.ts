import { redirect } from "next/navigation";
import { getSessionToken, validateSession } from "./session";
import type { User, Role } from "@prisma/client";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";

/**
 * Get the current authenticated user (returns null if not authenticated)
 */
export async function getCurrentUser(): Promise<User | null> {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  const user = await validateSession(token);
  return user;
}

/**
 * Require authentication (redirects to login if not authenticated)
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
      }),
    );
  }
  return user;
}

/**
 * Require specific role (redirects to login or throws error)
 */
export async function requireRole(
  allowedRoles: Role[]
): Promise<User> {
  const user = await requireUser();
  
  if (!allowedRoles.includes(user.role)) {
    throw new Error("Insufficient permissions");
  }
  
  return user;
}

/**
 * Check if user has role
 */
export async function hasRole(role: Role): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === role;
}
