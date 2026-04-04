import { NextResponse } from "next/server";
import { getGenresByCategory } from "@/lib/taxonomy/getGenresByCategory";

export const runtime = "nodejs";

/**
 * Жанры для выбранной категории события (обязательный query `categoryId`).
 * Возвращает поле `title` для совместимости с существующим UI (alias к `name`).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId")?.trim();
    if (!categoryId) {
      return NextResponse.json({ error: "categoryId required" }, { status: 400 });
    }

    const rows = await getGenresByCategory(categoryId);
    const genres = rows.map((r) => ({
      id: r.id,
      title: r.name,
      slug: r.slug,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
    }));

    return NextResponse.json({ genres });
  } catch (e) {
    console.error("[public/genres]", e);
    return NextResponse.json({ genres: [] as unknown[], error: "fetch_failed" }, { status: 200 });
  }
}
