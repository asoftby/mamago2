/**
 * GET /api/events/suggested-signals
 * 
 * Возвращает suggested signals для события на основе категории и жанров.
 * 
 * Query params:
 * - categorySlug: slug категории события
 * - genreSlugs: comma-separated список slug жанров
 * 
 * Response:
 * {
 *   suggested: {
 *     activitySignals: [...],
 *     formatSignals: [...],
 *     intentionSignals: [...],
 *     interestSignals: [...]
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSuggestedEventSignals } from "@/lib/event/eventSignalMapping";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get("categorySlug");
    const genreSlugsParam = searchParams.get("genreSlugs");

    const genreSlugs = genreSlugsParam
      ? genreSlugsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // Получаем suggested signal slugs
    const suggested = getSuggestedEventSignals(categorySlug, genreSlugs);

    // Резолвим slugs в полные объекты signals
    const allSlugs = [
      ...suggested.activitySignalSlugs,
      ...suggested.formatSignalSlugs,
      ...suggested.intentionSignalSlugs,
      ...suggested.interestSignalSlugs,
    ];

    if (allSlugs.length === 0) {
      return NextResponse.json({
        suggested: {
          activitySignals: [],
          formatSignals: [],
          intentionSignals: [],
          interestSignals: [],
        },
      });
    }

    // Получаем полные данные signals
    const signals = await prisma.signalDefinition.findMany({
      where: {
        slug: { in: allSlugs },
        isActive: true,
        status: "ACTIVE",
      },
      select: {
        id: true,
        slug: true,
        title: true,
        domain: true,
        parentId: true,
      },
    });

    // Создаем map для быстрого поиска
    const signalMap = new Map(signals.map((s) => [s.slug, s]));

    // Группируем по типам
    const activitySignals = suggested.activitySignalSlugs
      .map((slug) => signalMap.get(slug))
      .filter(Boolean);

    const formatSignals = suggested.formatSignalSlugs
      .map((slug) => signalMap.get(slug))
      .filter(Boolean);

    const intentionSignals = suggested.intentionSignalSlugs
      .map((slug) => signalMap.get(slug))
      .filter(Boolean);

    const interestSignals = suggested.interestSignalSlugs
      .map((slug) => signalMap.get(slug))
      .filter(Boolean);

    return NextResponse.json({
      suggested: {
        activitySignals,
        formatSignals,
        intentionSignals,
        interestSignals,
      },
    });
  } catch (error) {
    console.error("[suggested-signals] Error:", error);
    return NextResponse.json(
      { error: "Failed to get suggested signals" },
      { status: 500 }
    );
  }
}
