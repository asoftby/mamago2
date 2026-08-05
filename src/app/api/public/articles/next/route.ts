/**
 * GET/POST /api/public/articles/next — следующая статья в разделе журнала.
 * Не доверяет клиентским section/city без сверки с текущей статьёй.
 */
import { NextRequest, NextResponse } from "next/server";
import { GeoScope } from "@prisma/client";
import { z } from "zod";
import {
  findNextArticleInSection,
  MAX_NEXT_ARTICLE_EXCLUDE_IDS,
} from "@/lib/article/nextArticleInSection";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  currentArticleId: z.string().min(1).max(128),
  sectionId: z.string().min(1).max(128),
  cityId: z.string().min(1).max(128).nullable(),
  geoScope: z.nativeEnum(GeoScope),
  excludeIds: z
    .array(z.string().min(1).max(128))
    .max(MAX_NEXT_ARTICLE_EXCLUDE_IDS)
    .default([]),
});

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const { currentArticleId, sectionId, cityId, geoScope, excludeIds } =
      parsed.data;

    const result = await findNextArticleInSection({
      currentArticleId,
      sectionId,
      cityId,
      geoScope,
      excludeIds,
    });

    return NextResponse.json({
      article: result.article,
      exhausted: result.exhausted,
    });
  } catch (e) {
    console.error("[public/articles/next]", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
