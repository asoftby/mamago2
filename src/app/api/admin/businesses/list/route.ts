import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/businesses/list
 * Get all businesses for admin selection (including those without billing accounts)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const businesses = await prisma.business.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { owner: { email: { contains: search, mode: "insensitive" } } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        owner: {
          select: {
            email: true,
          },
        },
        billingAccount: {
          select: {
            id: true,
            depositBalance: true,
            currency: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      businesses: businesses.map((b) => ({
        id: b.id,
        name: b.name,
        ownerEmail: b.owner?.email || null,
        hasBillingAccount: !!b.billingAccount,
        currentBalance: b.billingAccount?.depositBalance.toNumber() || 0,
        currency: b.billingAccount?.currency || "BYN",
      })),
    });
  } catch (error: unknown) {
    console.error("Get businesses error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get businesses" },
      { status: 500 }
    );
  }
}
