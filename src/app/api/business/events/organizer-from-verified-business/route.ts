import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { checkBusinessToolPermission } from "@/server/permissions/business-permissions";

export const runtime = "nodejs";

/**
 * Materialize a verified business as an Organizer only after an explicit
 * selection by a user who can create business content. Searching is read-only.
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

    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        verificationStatus: "APPROVED",
        operationalStatus: "ACTIVE",
      },
      select: { id: true, name: true, unp: true, phone: true },
    });
    if (!business) {
      return NextResponse.json({ ok: false, error: "Подтверждённый организатор недоступен" }, { status: 404 });
    }

    const existingWhere: Prisma.OrganizerWhereInput = {
      OR: [
        { linkedBusinessId: business.id },
        ...(business.unp ? [{ unp: business.unp }] : []),
      ],
    };

    let organizer = await prisma.organizer.findFirst({
      where: existingWhere,
      orderBy: { createdAt: "asc" },
    });
    if (organizer?.linkedBusinessId && organizer.linkedBusinessId !== business.id) {
      return NextResponse.json({ ok: false, error: "Организатор связан с другой компанией" }, { status: 409 });
    }

    if (organizer && !organizer.linkedBusinessId) {
      organizer = await prisma.organizer.update({
        where: { id: organizer.id },
        data: { linkedBusinessId: business.id },
      });
    } else if (!organizer) {
      try {
        organizer = await prisma.organizer.create({
          data: {
            name: business.name,
            unp: business.unp,
            phone: business.phone,
            linkedBusinessId: business.id,
            createdFrom: "MANUAL",
          },
        });
      } catch (error) {
        // Another request may have created the row with this unique UNP.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || !business.unp) {
          throw error;
        }
        organizer = await prisma.organizer.findFirst({ where: { unp: business.unp } });
        if (!organizer || (organizer.linkedBusinessId && organizer.linkedBusinessId !== business.id)) {
          return NextResponse.json({ ok: false, error: "Конфликт привязки организатора" }, { status: 409 });
        }
        if (!organizer.linkedBusinessId) {
          organizer = await prisma.organizer.update({
            where: { id: organizer.id },
            data: { linkedBusinessId: business.id },
          });
        }
      }
    }

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
