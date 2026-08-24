import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { getArticleMediaItems } from "@/lib/article/articleMediaLibrary";

export const runtime = "nodejs";

/**
 * «Фото этой статьи» для media picker'а — все MediaAsset, на которые
 * ссылается статья, независимо от uploadedById (важно для migrated/legacy
 * статей). Вся агрегирующая логика — в getArticleMediaItems, эта route —
 * только auth-гейт и делегирование.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const items = await getArticleMediaItems(id);
  if (items === null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ items });
}
