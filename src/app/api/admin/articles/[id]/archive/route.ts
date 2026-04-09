import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { syncArticleCanonical } from "@/lib/seo/syncEntityCanonical";

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
    await prisma.article.update({
      where: { id },
      data: { status: "ARCHIVED" },
      select: { id: true },
    });
    await syncArticleCanonical(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[article archive]", e);
    const message =
      e instanceof Error && e.message
        ? e.message
        : "Не удалось перевести статью в архив";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
