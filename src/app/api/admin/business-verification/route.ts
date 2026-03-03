import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { BusinessVerificationStatus } from "@prisma/client";

export const runtime = "nodejs";

/**
 * GET /api/admin/business-verification?status=PENDING|APPROVED|REJECTED|DRAFT
 * List businesses by verification status
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    // Check admin/moderator role
    if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
      return NextResponse.json(
        { ok: false, error: "Доступ запрещен" },
        { status: 403 }
      );
    }

    // Get status filter from query
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");

    let statusFilter: BusinessVerificationStatus | undefined;
    if (statusParam) {
      const validStatuses: BusinessVerificationStatus[] = [
        "DRAFT",
        "PENDING",
        "APPROVED",
        "REJECTED",
      ];
      if (validStatuses.includes(statusParam as BusinessVerificationStatus)) {
        statusFilter = statusParam as BusinessVerificationStatus;
      }
    }

    // Fetch businesses
    const businesses = await prisma.business.findMany({
      where: statusFilter ? { verificationStatus: statusFilter } : undefined,
      select: {
        id: true,
        name: true,
        legalName: true,
        unp: true,
        phone: true,
        verificationStatus: true,
        submittedAt: true,
        reviewedAt: true,
        reviewNote: true,
        approvedAt: true,
        rejectedAt: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            email: true,
            phoneE164: true,
          },
        },
      },
      orderBy: [
        { submittedAt: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({
      ok: true,
      businesses,
    });
  } catch (error) {
    console.error("[admin/business-verification] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
