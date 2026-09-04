import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { syncArticleCanonical } from "@/lib/seo/syncEntityCanonical";
import { invalidatePublicArticleLists } from "@/server/article/publicArticleCache";
import {
  assertContentLifecycleOperationAllowed,
  isContentLifecycleOperationError,
  lifecycleErrorResponsePayload,
} from "@/server/services/contentLifecycleOperation.service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const article = await prisma.article.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!article) {
      return NextResponse.json(
        { code: "ARTICLE_NOT_FOUND", message: "Публикация не найдена" },
        { status: 404 },
      );
    }

    await assertContentLifecycleOperationAllowed({
      contentType: "ARTICLE",
      contentId: id,
      operation: "archiveContent",
      status: article.status,
      prisma,
    });

    await prisma.article.update({
      where: { id },
      data: { status: "ARCHIVED" },
      select: { id: true },
    });
    await syncArticleCanonical(id);
    invalidatePublicArticleLists();
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isContentLifecycleOperationError(e)) {
      return NextResponse.json(
        lifecycleErrorResponsePayload(e),
        { status: e.statusCode },
      );
    }
    console.error("[article archive]", e);
    const message =
      e instanceof Error && e.message
        ? e.message
        : "Не удалось перевести статью в архив";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
