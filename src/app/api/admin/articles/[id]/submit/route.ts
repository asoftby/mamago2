import { NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { moderateArticle, submitArticleForModeration } from "@/lib/article/articleAdminService";
import { resolveArticleSubmitAction } from "@/lib/article/articleSubmitPolicy";
import { invalidatePublicArticleLists } from "@/server/article/publicArticleCache";
import { createRequestPerf } from "@/server/utils/requestPerf";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const perf = createRequestPerf("publish-article:route:submit");
  const user = await requireAdminOrModerator();
  perf.mark("auth");
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    // Право на прямую публикацию проверяется здесь, на сервере (не по подписи кнопки).
    const action = resolveArticleSubmitAction(user.role);
    const snapshot =
      action === "publish"
        ? await moderateArticle(id, "publish")
        : await submitArticleForModeration(id);
    perf.mark("service");
    if (snapshot.status === "PUBLISHED") invalidatePublicArticleLists();
    perf.log({ articleId: id, status: snapshot.status });
    return NextResponse.json(snapshot);
  } catch (e) {
    console.error("[article submit]", e);
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
