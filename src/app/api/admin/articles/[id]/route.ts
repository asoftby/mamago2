import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import {
  ArticleAdminPutBodySchema,
  articleSaveInputFromPutBody,
} from "@/lib/article/articleAdminPutBody";
import { getArticleForEditor, saveArticleDraft } from "@/lib/article/articleAdminService";
import prisma from "@/lib/prisma";
import { createRequestPerf } from "@/server/utils/requestPerf";
import { invalidatePublicArticleLists } from "@/server/article/publicArticleCache";
import {
  assertContentLifecycleOperationAllowed,
  isContentLifecycleOperationError,
  lifecycleErrorResponsePayload,
} from "@/server/services/contentLifecycleOperation.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const perf = createRequestPerf("save-article:route:get");
  const user = await requireAdminOrModerator();
  perf.mark("auth");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const article = await getArticleForEditor(id);
  perf.mark("service");
  if (!article) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  perf.log({ articleId: id });
  return NextResponse.json(article);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const perf = createRequestPerf("save-article:route:update");
  const user = await requireAdminOrModerator();
  perf.mark("auth");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  perf.mark("parse");

  const parsed = ArticleAdminPutBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  perf.mark("validate");

  const input = articleSaveInputFromPutBody(parsed.data);

  try {
    const snapshot = await saveArticleDraft(id, input);
    perf.mark("service");
    // A save can publish, unpublish, move geography, or change list-facing
    // title/category/tags. Invalidating once here is safer than trying to
    // reconstruct old/new list membership after the transaction.
    invalidatePublicArticleLists();
    perf.log({ articleId: id, status: snapshot.status });
    return NextResponse.json(snapshot);
  } catch (e) {
    console.error("[admin/articles PUT]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 400 },
    );
  }
}

/**
 * Удаление: только полностью изолированные черновики.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const row = await prisma.article.findUnique({
    where: { id },
    select: { status: true },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const deleteOperation =
    row.status === "ARCHIVED" ? "deleteArchived" : "deleteDraft";

  if (deleteOperation === "deleteArchived" && user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Удаление из архива доступно только администратору" },
      { status: 403 },
    );
  }

  try {
    await assertContentLifecycleOperationAllowed({
      contentType: "ARTICLE",
      contentId: id,
      operation: deleteOperation,
      status: row.status,
      actorRole: user.role,
      prisma,
    });

    await prisma.article.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isContentLifecycleOperationError(e)) {
      return NextResponse.json(
        lifecycleErrorResponsePayload(e),
        { status: e.statusCode },
      );
    }
    console.error("[admin/articles DELETE]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 400 },
    );
  }
}
