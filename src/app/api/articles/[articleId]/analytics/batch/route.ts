import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  ARTICLE_PERFORMANCE_ANALYTICS_SCOPE,
  ARTICLE_PERFORMANCE_BATCH_MAX_BYTES,
  ArticlePerformanceBatchSchema,
} from "@/lib/article/articlePerformanceAnalytics";

/**
 * Cheap target lookup: block telemetry must never add a publication-table read
 * to every individual impression/click. The actual batch still writes one row.
 */
const loadArticleAnalyticsTarget = unstable_cache(
  async (articleId: string) =>
    prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, status: true, cityId: true },
    }),
  ["article-performance-target-v1"],
  { revalidate: 60 },
);

/**
 * One request / one UserEvent row may represent dozens of in-page block facts.
 * We deliberately DO NOT call AnalyticsEventService here: these reporting-only
 * facts must not touch UserBehaviorProfile, recommendations or promotion.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ articleId: string }> },
) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > ARTICLE_PERFORMANCE_BATCH_MAX_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > ARTICLE_PERFORMANCE_BATCH_MAX_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ArticlePerformanceBatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid analytics batch" }, { status: 400 });
  }

  const { articleId: rawArticleId } = await context.params;
  const articleId = rawArticleId.trim();
  if (!articleId) return NextResponse.json({ error: "Missing article" }, { status: 400 });

  const article = await loadArticleAnalyticsTarget(articleId);
  if (!article || article.status !== "PUBLISHED") {
    // Preview/draft traffic is intentionally not part of reportable performance.
    return new NextResponse(null, { status: 204 });
  }

  await prisma.userEvent.create({
    data: {
      sessionId: parsed.data.sessionId,
      eventType: "FILTER_APPLY",
      entityType: "ARTICLE",
      entityId: article.id,
      vertical: article.cityId ? "CITY" : undefined,
      cityId: article.cityId ?? undefined,
      meta: {
        analyticsScope: ARTICLE_PERFORMANCE_ANALYTICS_SCOPE,
        schemaVersion: 1,
        events: parsed.data.events,
      },
    },
  });

  return new NextResponse(null, { status: 204 });
}
