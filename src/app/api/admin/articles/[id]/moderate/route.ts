import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { moderateArticle } from "@/lib/article/articleAdminService";
import { createRequestPerf } from "@/server/utils/requestPerf";

const BodySchema = z.object({
  decision: z.enum(["publish", "reject"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const perf = createRequestPerf("publish-article:route:moderate");
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  perf.mark("validate");

  try {
    const snapshot = await moderateArticle(id, parsed.data.decision);
    perf.mark("service");
    perf.log({ articleId: id, decision: parsed.data.decision, status: snapshot.status });
    return NextResponse.json(snapshot);
  } catch (e) {
    console.error("[article moderate]", e);
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
