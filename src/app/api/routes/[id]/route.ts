/**
 * PATCH /api/routes/[id] — update an existing route (author only)
 * DELETE /api/routes/[id] — delete a route (author only)
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import prisma from "@/lib/prisma";
import { updateRoute, normalizeStops } from "@/server/services/route.service";
import type { BudgetLevel, RouteVisibility } from "@prisma/client";

// ─── Shared helper ─────────────────────────────────────────────────────────────

async function resolveRouteId(
  request: NextRequest,
  params: Promise<{ id: string }>,
): Promise<string | null> {
  const { id } = await params;
  return id || new URL(request.url).pathname.split("/").at(-1) || null;
}

// ─── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const routeId = await resolveRouteId(request, params);
    if (!routeId) {
      return NextResponse.json(
        { error: "Route ID is required" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const {
      title,
      ageTags = [],
      budgetLevel = "LOW",
      visibility = "PRIVATE",
      publish = false,
      stops = [],
    } = body as {
      title: string;
      ageTags?: string[];
      budgetLevel?: BudgetLevel;
      visibility?: RouteVisibility;
      publish?: boolean;
      stops?: {
        order?: number;
        address?: string;
        note?: string;
        photoUrl?: string | null;
        lat?: number | null;
        lng?: number | null;
        placeId?: string | null;
        customTitle?: string | null;
      }[];
    };

    if (!title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (publish) {
      const normalized = normalizeStops(stops);
      if (normalized.length < 2) {
        return NextResponse.json(
          { error: "at least 2 stops required to publish" },
          { status: 400 },
        );
      }
    }

    const result = await updateRoute(user.id, routeId, {
      title: title.trim(),
      ageTags,
      budgetLevel,
      visibility,
      publish,
      stops,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "ROUTE_NOT_FOUND") {
        return NextResponse.json({ error: "Route not found" }, { status: 404 });
      }
      if (err.message === "ROUTE_FORBIDDEN") {
        return NextResponse.json(
          { error: "You can only edit your own routes" },
          { status: 403 },
        );
      }
    }
    console.error("[API] PATCH /api/routes/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ─── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Next.js 15+: params is a Promise
    const { id } = await params;

    // Fallback: extract from URL if params is empty
    const resolvedId = id || new URL(request.url).pathname.split("/").at(-1);

    if (!resolvedId) {
      return NextResponse.json(
        { error: "Route ID is required" },
        { status: 400 },
      );
    }

    // Find the route
    const route = await prisma.route.findUnique({
      where: { id: resolvedId },
      select: { id: true, authorId: true, title: true },
    });

    if (!route) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    // Check if user is the author
    if (route.authorId !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own routes" },
        { status: 403 },
      );
    }

    // Delete the route (cascade will delete related stops, slug history, etc.)
    await prisma.route.delete({
      where: { id: resolvedId },
    });

    return NextResponse.json(
      { success: true, message: "Route deleted successfully" },
      { status: 200 },
    );
  } catch (err) {
    console.error("[API] DELETE /api/routes/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
