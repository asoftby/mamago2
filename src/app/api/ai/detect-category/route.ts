import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { detectEventCategory } from "@/lib/ai/detectEventCategory";

export const runtime = "nodejs";
export const maxDuration = 30;

const detectCategoryRequestSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().optional(),
  shortDescription: z.string().trim().optional(),
  venueName: z.string().trim().optional(),
  addressText: z.string().trim().optional(),
  categoryCandidates: z.array(z.string()).optional(),
  ageText: z.string().trim().optional(),
  priceText: z.string().trim().optional(),
  scheduleText: z.string().trim().optional(),
  organizerName: z.string().trim().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canCreateBusinessContent(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = detectCategoryRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    console.log("[AI Category Detection API] Request:", {
      title: parsed.data.title,
      hasDescription: !!parsed.data.description,
      hasVenue: !!parsed.data.venueName,
      categoryCandidatesCount: parsed.data.categoryCandidates?.length ?? 0,
    });

    const result = await detectEventCategory(parsed.data);

    if (!result) {
      return NextResponse.json(
        {
          error: "Could not detect category",
          message:
            "AI не смог определить категорию с достаточной уверенностью. Попробуйте добавить больше контекста.",
        },
        { status: 200 },
      );
    }

    console.log("[AI Category Detection API] Success:", {
      categoryPath: result.categoryPath,
      confidence: result.confidence,
    });

    return NextResponse.json({
      success: true,
      category: {
        id: result.categoryId,
        slug: result.categorySlug,
        nameRu: result.categoryNameRu,
        path: result.categoryPath,
        rootCategoryId: result.rootCategoryId,
        subcategoryId: result.subcategoryId,
        confidence: result.confidence,
        reason: result.reason,
      },
      provider: "openrouter",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "AI request timed out" }, { status: 504 });
    }

    console.error("[AI Category Detection API] Error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
