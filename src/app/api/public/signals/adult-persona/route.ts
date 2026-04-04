import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export type AdultPersonaSignalChip = {
  id: string;
  slug: string;
  title: string;
  order: number;
};

/**
 * Публичный справочник чипов профиля взрослого: предпочтения и формат досуга (иерархия SignalDefinition).
 */
export async function GET() {
  try {
    const roots = await prisma.signalDefinition.findMany({
      where: {
        slug: { in: ["preferences", "leisure-format"] },
        parentId: null,
        isActive: true,
      },
      include: {
        children: {
          where: { isActive: true },
          orderBy: [{ order: "asc" }, { id: "asc" }],
          select: { id: true, slug: true, title: true, order: true },
        },
      },
    });
    const pref = roots.find((r) => r.slug === "preferences");
    const lf = roots.find((r) => r.slug === "leisure-format");
    const preferenceSignals: AdultPersonaSignalChip[] = (pref?.children ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      order: c.order,
    }));
    const formatSignals: AdultPersonaSignalChip[] = (lf?.children ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      order: c.order,
    }));
    return NextResponse.json({ preferenceSignals, formatSignals });
  } catch (e) {
    console.error("[public/signals/adult-persona]", e);
    return NextResponse.json(
      { preferenceSignals: [] as AdultPersonaSignalChip[], formatSignals: [] as AdultPersonaSignalChip[] },
      { status: 200 },
    );
  }
}
