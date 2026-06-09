import { NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { submitArticleForModeration } from "@/lib/article/articleAdminService";
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
    const snapshot = await submitArticleForModeration(id);
    perf.mark("service");
    perf.log({ articleId: id, status: snapshot.status });
    return NextResponse.json(snapshot);
  } catch (e) {
    console.error("[article submit]", e);
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
