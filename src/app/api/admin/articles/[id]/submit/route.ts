import { NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { submitArticleForModeration } from "@/lib/article/articleAdminService";

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
    await submitArticleForModeration(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[article submit]", e);
    return NextResponse.json({ error: "Failed" }, { status: 400 });
  }
}
