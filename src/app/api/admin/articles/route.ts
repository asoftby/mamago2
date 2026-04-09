import { NextRequest, NextResponse } from "next/server";
import {
  ArticleAdminPutBodySchema,
  articleSaveInputFromPutBody,
} from "@/lib/article/articleAdminPutBody";
import { createArticleFromSaveInput } from "@/lib/article/articleAdminService";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";

/** Первая запись статьи (явное «Сохранить черновик» / «Опубликовать»), не при открытии формы. */
export async function POST(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ArticleAdminPutBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const input = articleSaveInputFromPutBody(parsed.data);
    const snapshot = await createArticleFromSaveInput(input);
    return NextResponse.json(snapshot);
  } catch (e) {
    console.error("[admin/articles POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Create failed" },
      { status: 400 },
    );
  }
}
