import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { detectEventCategory } from "@/lib/ai/detectEventCategory";
import {
  AiBudgetExceededError,
  resolveAiBudgetPrincipal,
  withAiBudget,
} from "@/server/ai/aiBudget";

export const runtime = "nodejs";
export const maxDuration = 30;

const detectCategoryRequestSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(8_000).optional(),
  shortDescription: z.string().trim().max(1_000).optional(),
  venueName: z.string().trim().max(300).optional(),
  addressText: z.string().trim().max(500).optional(),
  categoryCandidates: z.array(z.string().trim().max(200)).max(50).optional(),
  ageText: z.string().trim().max(200).optional(),
  priceText: z.string().trim().max(300).optional(),
  scheduleText: z.string().trim().max(500).optional(),
  organizerName: z.string().trim().max(300).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const principal = await resolveAiBudgetPrincipal(user, "content.create");
    if (!principal) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = detectCategoryRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await withAiBudget({
      principal,
      endpoint: "detect-category",
      logSecurityEvent: (event) => console.warn(`[security] ${event}`),
      operation: () => detectEventCategory(parsed.data),
    });
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
    if (error instanceof AiBudgetExceededError) {
      return NextResponse.json(
        { error: "Слишком много AI-запросов. Попробуйте позже." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "AI request timed out" }, { status: 504 });
    }
    console.error("[AI Category Detection API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
