import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import {
  ArticleAdminPutBodySchema,
  articleSaveInputFromPutBody,
} from "@/lib/article/articleAdminPutBody";
import { getArticleForEditor, saveArticleDraft } from "@/lib/article/articleAdminService";
import prisma from "@/lib/prisma";
import { createRequestPerf } from "@/server/utils/requestPerf";

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
 * Удаление: черновики (DRAFT) — сразу; опубликованные/прочее — только после ARCHIVED.
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

  const canDelete =
    row.status === "DRAFT" || row.status === "ARCHIVED";

  if (!canDelete) {
    return NextResponse.json(
      {
        error: "DELETE_NOT_ALLOWED",
        message: "Сначала архивируйте материал, затем удалите",
      },
      { status: 400 },
    );
  }

  try {
    await prisma.article.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/articles DELETE]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 400 },
    );
  }
}
