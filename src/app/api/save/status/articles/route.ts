import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { hasArticleIdeasBatch } from "@/server/services/idea.service";
import { listArticlePlanItemsBatch } from "@/server/services/plan.service";
import { resolveIdeaPlanState } from "@/lib/plan/ideaPlanStatus";
import { parseArticleIdsForBatch } from "@/lib/save/parseArticleIdsForBatch";

export type ArticleSaveStatusEntry = {
  isSaved: boolean;
  isIdea: boolean;
  inPlan: boolean;
  planDate: string | null;
  planStartsAt: Date | null;
  planItemId: string | null;
};

/**
 * Batched save-status for a set of Article cards (idea + plan state).
 * One bounded, deduped, user-scoped query pair — avoids N+1 per-card
 * /api/save/status calls on Article listing surfaces.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const rawIds =
      body && typeof body === "object"
        ? (body as { articleIds?: unknown }).articleIds
        : undefined;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json(
        { error: "articleIds is required" },
        { status: 400 }
      );
    }

    const articleIds = parseArticleIdsForBatch(rawIds);

    if (articleIds.length === 0) {
      return NextResponse.json(
        { error: "articleIds must contain at least one valid id" },
        { status: 400 }
      );
    }

    const [ideaSet, planItems] = await Promise.all([
      hasArticleIdeasBatch(user.id, articleIds),
      listArticlePlanItemsBatch(user.id, articleIds),
    ]);

    const planItemsByArticle = new Map<string, { id: string; date: string }[]>();
    const startsAtById = new Map<string, Date | null>();
    for (const item of planItems) {
      if (!item.articleId) continue;
      const list = planItemsByArticle.get(item.articleId) ?? [];
      list.push({ id: item.id, date: item.date });
      planItemsByArticle.set(item.articleId, list);
      startsAtById.set(item.id, item.startsAt);
    }

    const statuses: Record<string, ArticleSaveStatusEntry> = {};
    for (const articleId of articleIds) {
      const isIdea = ideaSet.has(articleId);
      const items = planItemsByArticle.get(articleId) ?? [];
      const planState = resolveIdeaPlanState(items);
      const planItemId = planState.planItemId ?? null;
      statuses[articleId] = {
        isSaved: isIdea || items.length > 0,
        isIdea,
        inPlan: planState.isPlanned,
        planDate: planState.plannedDate ?? null,
        planStartsAt: planItemId ? startsAtById.get(planItemId) ?? null : null,
        planItemId,
      };
    }

    return NextResponse.json({ statuses });
  } catch (error) {
    console.error("Batch article save status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
