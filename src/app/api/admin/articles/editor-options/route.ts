import { NextResponse } from "next/server";
import { Role, UserStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";

export const runtime = "nodejs";

/**
 * Справочники для редактора статьи: города + пользователи, которые могут быть системными авторами.
 */
export async function GET() {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [cities, authors] = await Promise.all([
    prisma.city.findMany({
      where: { isLegacyNonCity: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.MODERATOR] },
        status: UserStatus.ACTIVE,
      },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: { id: true, displayName: true, email: true },
    }),
  ]);

  const authorOptions = authors.map((a) => ({
    id: a.id,
    label: (a.displayName?.trim() || a.email.split("@")[0] || a.email).trim(),
    email: a.email,
  }));

  return NextResponse.json({ cities, authors: authorOptions });
}
