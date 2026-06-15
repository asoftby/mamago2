import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModeratorApiUser } from "@/lib/auth/requireAdminApi";
import { invalidateAdminCityRowsCache } from "@/server/city/cityAdminData";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminOrModeratorApiUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      isActive?: boolean;
      isVisibleInCityFilter?: boolean;
      priority?: number;
    };

    const updated = await prisma.city.update({
      where: { id },
      data: {
        ...(typeof body.isActive === "boolean"
          ? { isActive: body.isActive }
          : {}),
        ...(typeof body.isVisibleInCityFilter === "boolean"
          ? { isVisibleInCityFilter: body.isVisibleInCityFilter }
          : {}),
        ...(typeof body.priority === "number"
          ? { priority: body.priority }
          : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        isVisibleInCityFilter: true,
        priority: true,
      },
    });

    invalidateAdminCityRowsCache();
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating city:", error);
    return NextResponse.json(
      { error: "Failed to update city" },
      { status: 500 },
    );
  }
}
