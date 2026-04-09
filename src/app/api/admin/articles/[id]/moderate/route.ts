import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { moderateArticle } from "@/lib/article/articleAdminService";

const BodySchema = z.object({
  decision: z.enum(["publish", "reject"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminOrModerator();
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await moderateArticle(id, parsed.data.decision);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[article moderate]", e);
    return NextResponse.json({ error: "Failed" }, { status: 400 });
  }
}
