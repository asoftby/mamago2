import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

/** Публичный read-only список категорий событий для мастера (корни + дети, только активные). */
export async function GET() {
  try {
    const rows = await prisma.eventCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        nameRu: true,
        slug: true,
        icon: true,
        parentId: true,
        sortOrder: true,
      },
    });

    const roots = rows.filter((r) => r.parentId == null);
    const childrenByParent = new Map<string, typeof rows>();
    for (const r of rows) {
      if (r.parentId) {
        const list = childrenByParent.get(r.parentId) ?? [];
        list.push(r);
        childrenByParent.set(r.parentId, list);
      }
    }

    const categories = roots.map((root) => ({
      ...root,
      children: (childrenByParent.get(root.id) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
      ),
    }));

    return NextResponse.json({ categories });
  } catch (e) {
    console.error("[public/event-categories]", e);
    return NextResponse.json({ categories: [] as unknown[], error: "fetch_failed" }, { status: 200 });
  }
}
