import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { checkBusinessToolPermission } from "@/server/permissions/business-permissions";

export const runtime = "nodejs";

/**
 * Resolve a verified Business into a persistent Organizer, only when explicitly
 * selected. Lock the Business row so concurrent clicks cannot create duplicates,
 * including for SELF_EMPLOYED_NPD businesses without UNP.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Требуется авторизация" }, { status: 401 });
    }
    if (!(await checkBusinessToolPermission(user, "content.create"))) {
      return NextResponse.json({ ok: false, error: "Доступ запрещён" }, { status: 403 });
    }

    const input = (await request.json()) as { businessId?: unknown };
    const businessId = typeof input.businessId === "string" ? input.businessId.trim() : "";
    if (!businessId || businessId.length > 128) {
      return NextResponse.json({ ok: false, error: "Некорректный идентификатор бизнеса" }, { status: 400 });
    }

    const resolve = () => prisma.$transaction(async (tx) => {
      // Serialization is essential because Organizer.linkedBusinessId is not unique.
      await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${businessId} FOR UPDATE`;

      // Recheck eligibility under the lock; a rejected/disabled business cannot be selected.
      const business = await tx.business.findFirst({
        where: {
          id: businessId,
          verificationStatus: "APPROVED",
          operationalStatus: "ACTIVE",
        },
        select: { id: true, name: true, unp: true, phone: true },
      });
      if (!business) {
        return { ok: false as const, status: 404 as const, error: "Подтверждённый организатор недоступен" };
      }

      // A Business-linked organizer takes precedence over any legacy unlinked row.
      let organizer = await tx.organizer.findFirst({
        where: { linkedBusinessId: business.id },
        orderBy: { createdAt: "asc" },
      });
      if (!organizer && business.unp) {
        organizer = await tx.organizer.findUnique({ where: { unp: business.unp } });
      }
      if (organizer?.linkedBusinessId && organizer.linkedBusinessId !== business.id) {
        return { ok: false as const, status: 409 as const, error: "Организатор связан с другой компанией" };
      }

      if (organizer && !organizer.linkedBusinessId) {
        organizer = await tx.organizer.update({
          where: { id: organizer.id },
          data: { linkedBusinessId: business.id },
        });
      } else if (!organizer) {
        organizer = await tx.organizer.create({
          data: {
            name: business.name,
            unp: business.unp,
            phone: business.phone,
            linkedBusinessId: business.id,
            createdFrom: "MANUAL",
          },
        });
      }

      return { ok: true as const, organizer };
    });

    let result: Awaited<ReturnType<typeof resolve>>;
    try {
      result = await resolve();
    } catch (error) {
      // An unrelated writer may have inserted a row with the same unique UNP
      // concurrently. Retry in a fresh transaction, after the failed one rolled back.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      result = await resolve();
    }

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }

    const organizer = result.organizer;
    return NextResponse.json({
      ok: true,
      organizer: {
        id: organizer.id,
        name: organizer.name,
        unp: organizer.unp ?? undefined,
        phone: organizer.phone ?? undefined,
        website: organizer.website ?? undefined,
        instagram: organizer.instagram ?? undefined,
        linkedBusinessId: organizer.linkedBusinessId,
        isVerified: true,
      },
    });
  } catch (error) {
    console.error("[business/events/organizer-from-verified-business] Error:", error);
    return NextResponse.json({ ok: false, error: "Не удалось выбрать организатора" }, { status: 500 });
  }
}
