import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

const SELECT_FIELDS = {
  id: true,
  displayName: true,
  email: true,
  avatarUrl: true,
  role: true,
} as const;

/**
 * GET /api/admin/users/search?q=<query>&limit=<n>&id=<userId>
 *
 * Lean user search for pickers (e.g. author assignment).
 * Returns only the fields needed for UI: id, displayName, email, avatarUrl, role.
 *
 * - Pass `id` to resolve a single user by ID (returns a single object, not an array).
 * - Pass `q` to search by name/email (returns an array).
 * Requires ADMIN or MODERATOR role.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole([Role.ADMIN, Role.MODERATOR]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim() ?? "";

  // Single user lookup by id.
  if (id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: SELECT_FIELDS,
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(user);
  }

  // Search by query.
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit") ?? "20")), 50);

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { displayName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const users = await prisma.user.findMany({
    where,
    select: SELECT_FIELDS,
    orderBy: [{ displayName: "asc" }, { email: "asc" }],
    take: limit,
  });

  return NextResponse.json(users);
}
