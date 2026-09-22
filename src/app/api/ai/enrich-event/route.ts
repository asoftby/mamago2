import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { enrichEvent } from "@/lib/ai/enrichEvent";
import {
  AiBudgetExceededError,
  resolveAiBudgetPrincipal,
  withAiBudget,
} from "@/server/ai/aiBudget";

export const runtime = "nodejs";
export const maxDuration = 30;

const enrichEventRequestSchema = z.object({
  importedRecordId: z.string().trim().min(1).max(200).optional(),
  activityId: z.string().trim().min(1).max(200).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const principal = await resolveAiBudgetPrincipal(user, "content.update");
    if (!principal) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = enrichEventRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (!parsed.data.importedRecordId && !parsed.data.activityId) {
      return NextResponse.json(
        { error: "Either importedRecordId or activityId is required" },
        { status: 400 },
      );
    }

    const result = await withAiBudget({
      principal,
      endpoint: "enrich-event",
      logSecurityEvent: (event) => console.warn(`[security] ${event}`),
      operation: () => enrichEvent({
        importedRecordId: parsed.data.importedRecordId ?? null,
        activityId: parsed.data.activityId ?? null,
      }),
    });

    return NextResponse.json({ result });
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
    console.error("AI event enrichment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
