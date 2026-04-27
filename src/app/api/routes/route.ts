/**
 * POST /api/routes
 * Create a new route (draft or published).
 * Auth optional — anonymous routes are allowed (authorId = null for editorial).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { createRoute } from "@/server/services/route.service";
import type { BudgetLevel, RouteVisibility } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await request.json();

    const {
      title,
      ageTags = [],
      budgetLevel = "LOW",
      visibility = "PUBLIC",
      publish = false,
      stops = [],
    } = body as {
      title: string;
      ageTags?: string[];
      budgetLevel?: BudgetLevel;
      visibility?: RouteVisibility;
      publish?: boolean;
      stops?: {
        order: number;
        address?: string;
        note: string;
        photoUrl?: string;
        lat?: number;
        lng?: number;
        placeId?: string;
        customTitle?: string;
      }[];
    };

    if (!title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    // Для публикации требуем минимум 2 остановки, для черновика можно без них
    if (publish && (!stops || stops.length < 2)) {
      return NextResponse.json(
        { error: "at least 2 stops required" },
        { status: 400 },
      );
    }

    const result = await createRoute(user?.id ?? null, {
      title: title.trim(),
      ageTags,
      budgetLevel,
      visibility,
      publish,
      stops: stops.map((s, i) => ({
        order: s.order ?? i + 1,
        address: s.address ?? "",
        note: s.note ?? "",
        photoUrl: s.photoUrl,
        lat: s.lat,
        lng: s.lng,
        placeId: s.placeId,
        customTitle: s.customTitle,
      })),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[API] POST /api/routes error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
