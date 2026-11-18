import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { parsePaginationParams } from "@/lib/api/pagination";
import { Prisma } from "@prisma/client";
import { checkBusinessToolPermission } from "@/server/permissions/business-permissions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Требуется авторизация" }, { status: 401 });
    }

    // Partner cabinet access is based on active BusinessMember, not User.role.
    if (!(await checkBusinessToolPermission(user, "content.create"))) {
      return NextResponse.json({ ok: false, error: "Доступ запрещен" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("query") ?? searchParams.get("q") ?? "").trim();
    const { limit } = parsePaginationParams(searchParams, { defaultLimit: 10, maxLimit: 30 });

    const [organizers, businesses] = await Promise.all([
      prisma.organizer.findMany({
        where: query
          ? {
              OR: [
                { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
                { phone: { contains: query, mode: Prisma.QueryMode.insensitive } },
                { website: { contains: query, mode: Prisma.QueryMode.insensitive } },
                { instagram: { contains: query, mode: Prisma.QueryMode.insensitive } },
                { unp: { contains: query, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : undefined,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: limit,
        select: {
          id: true,
          name: true,
          unp: true,
          phone: true,
          website: true,
          instagram: true,
          createdFrom: true,
          linkedBusinessId: true,
        },
      }),
      // A verified Business may not have a separate Organizer row yet.
      // Look it up without creating data in this GET request.
      query
        ? prisma.business.findMany({
            where: {
              verificationStatus: "APPROVED",
              operationalStatus: "ACTIVE",
              OR: [
                { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
                { legalName: { contains: query, mode: Prisma.QueryMode.insensitive } },
                { unp: { contains: query, mode: Prisma.QueryMode.insensitive } },
              ],
            },
            select: { id: true, name: true, unp: true, phone: true },
            orderBy: { updatedAt: "desc" },
            take: limit,
          })
        : Promise.resolve([]),
    ]);

    const businessIds = businesses.map((business) => business.id);
    const businessUnps = businesses.flatMap((business) => business.unp ? [business.unp] : []);
    const existingForBusinesses = businessIds.length
      ? await prisma.organizer.findMany({
          where: {
            OR: [
              { linkedBusinessId: { in: businessIds } },
              ...(businessUnps.length ? [{ unp: { in: businessUnps } }] : []),
            ],
          },
          select: {
            id: true,
            name: true,
            unp: true,
            phone: true,
            website: true,
            instagram: true,
            createdFrom: true,
            linkedBusinessId: true,
          },
        })
      : [];

    const serialize = (organizer: (typeof organizers)[number], isVerified = false) => ({
      id: organizer.id,
      name: organizer.name,
      unp: organizer.unp ?? undefined,
      phone: organizer.phone ?? undefined,
      website: organizer.website ?? undefined,
      instagram: organizer.instagram ?? undefined,
      createdFrom: organizer.createdFrom === "IMPORT" ? "import" : "manual",
      linkedBusinessId: organizer.linkedBusinessId,
      isVerified,
    });

    const merged = [
      ...businesses.map((business) => {
        const existing = existingForBusinesses.find(
          (organizer) =>
            organizer.linkedBusinessId === business.id ||
            (business.unp && organizer.unp === business.unp && !organizer.linkedBusinessId),
        );
        return existing
          ? serialize(existing, true)
          : {
              id: `business:${business.id}`,
              name: business.name,
              unp: business.unp ?? undefined,
              phone: business.phone ?? undefined,
              linkedBusinessId: business.id,
              isVerified: true,
            };
      }),
      ...organizers.map((organizer) => serialize(organizer)),
    ];
    const seen = new Set<string>();
    const results = merged.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }).slice(0, limit);

    return NextResponse.json({ ok: true, organizers: results });
  } catch (error) {
    console.error("[admin/organizers] Error:", error);
    return NextResponse.json({ ok: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
