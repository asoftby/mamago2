import { NextRequest, NextResponse } from "next/server";
import {
  ArticleAdminPutBodySchema,
  articleSaveInputFromPutBody,
} from "@/lib/article/articleAdminPutBody";
import { createArticleFromSaveInput } from "@/lib/article/articleAdminService";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { createRequestPerf } from "@/server/utils/requestPerf";
import { invalidatePublicArticleLists } from "@/server/article/publicArticleCache";

/** Первая запись статьи (явное «Сохранить черновик» / «Опубликовать»), не при открытии формы. */
export async function POST(req: NextRequest) {
  const perf = createRequestPerf("save-article:route:create");
  const user = await requireAdminOrModerator();
  perf.mark("auth");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  try {
    const input = articleSaveInputFromPutBody(parsed.data);
    const snapshot = await createArticleFromSaveInput(input);
    perf.mark("service");
    if (snapshot.status === "PUBLISHED") {
      invalidatePublicArticleLists();
    }
    perf.log({ status: snapshot.status, articleId: snapshot.id });
    return NextResponse.json(snapshot);
  } catch (e) {
    console.error("[admin/articles POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Create failed" },
      { status: 400 },
    );
  }
}
