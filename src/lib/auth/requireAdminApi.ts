/**
 * Route Handler auth guards for /api/admin/* routes.
 *
 * Usage:
 *   const auth = await requireAdminApiUser();
 *   if (auth instanceof NextResponse) return auth;
 *   const user = auth; // User with role === "ADMIN"
 *
 *   const auth = await requireAdminOrModeratorApiUser();
 *   if (auth instanceof NextResponse) return auth;
 *   const user = auth; // User with role === "ADMIN" | "MODERATOR"
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "./server";
import type { User } from "@prisma/client";

type AuthResult = User | NextResponse;

/**
 * Require ADMIN role for API route handlers.
 * Returns the User if authorized, or a NextResponse error otherwise.
 */
export async function requireAdminApiUser(): Promise<AuthResult> {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return user;
}

/**
 * Require ADMIN or MODERATOR role for API route handlers.
 * Returns the User if authorized, or a NextResponse error otherwise.
 */
export async function requireAdminOrModeratorApiUser(): Promise<AuthResult> {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return user;
}