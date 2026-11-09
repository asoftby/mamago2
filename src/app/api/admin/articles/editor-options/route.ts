import { NextResponse } from "next/server";
import { Role, UserStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { DEFAULT_COUNTRY_ISO } from "@/server/geo/geoConstants";
import { buildArticleEditorCityOptionsWhere } from "@/lib/article/articleEditorOptions";

export const runtime = "nodejs";

/**
 * Справочники для редактора статьи: города, области (регионы) + пользователи, которые могут быть системными авторами.
 */
export async function GET(request: Request) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const selectedOccasionId = new URL(request.url).searchParams.get("selectedOccasionId");
  const selectedCategoryIds = new URL(request.url).searchParams.get("selectedCategoryIds")
    ?.split(",").filter(Boolean) ?? [];
  const selectedRegionIds = new URL(request.url).searchParams.get("selectedRegionIds")
    ?.split(",").filter(Boolean) ?? [];
  const selectedCityIds = new URL(request.url).searchParams.get("selectedCityIds")
    ?.split(",").filter(Boolean) ?? [];
  const [cities, regions, authors, categories, occasions] = await Promise.all([
    prisma.city.findMany({
      where: buildArticleEditorCityOptionsWhere(selectedCityIds),
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.region.findMany({
      where: {
        type: "OBLAST",
        OR: [{ isActive: true }, ...(selectedRegionIds.length ? [{ id: { in: selectedRegionIds } }] : [])],
        country: { isoCode: DEFAULT_COUNTRY_ISO },
      },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
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
    prisma.eventCategory.findMany({
      where: {
        publicationType: "ARTICLE",
        parentId: null,
        OR: [
          { isActive: true, archivedAt: null },
          ...(selectedCategoryIds.length ? [{ id: { in: selectedCategoryIds } }] : []),
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { nameRu: "asc" }],
      select: { id: true, nameRu: true, slug: true },
    }),
    prisma.occasion.findMany({
      where: {
        type: { in: ["HOLIDAY", "SEASON", "EVENT"] },
        OR: [{ isActive: true, startsAt: { not: null }, endsAt: { not: null } },
          ...(selectedOccasionId ? [{ id: selectedOccasionId }] : [])],
      },
      select: { id: true, name: true, startsAt: true, endsAt: true, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const authorOptions = authors.map((a) => ({
    id: a.id,
    label: (a.displayName?.trim() || a.email.split("@")[0] || a.email).trim(),
    email: a.email,
  }));

  return NextResponse.json({
    cities,
    regions,
    authors: authorOptions,
    categories: categories.map((c) => ({
      id: c.id,
      label: c.nameRu,
      slug: c.slug,
    })),
    occasions: occasions.map((occasion) => ({
      id: occasion.id, label: occasion.name, isActive: occasion.isActive,
      startsAt: occasion.startsAt?.toISOString() ?? null,
      endsAt: occasion.endsAt?.toISOString() ?? null,
    })),
  });
}
