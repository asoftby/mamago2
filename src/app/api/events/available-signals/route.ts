/**
 * GET /api/events/available-signals
 * 
 * Возвращает все доступные Discovery и Profile signals для Event.
 * Используется для ручного выбора signals в UI.
 * 
 * Response:
 * {
 *   activitySignals: [...],
 *   formatSignals: [...],
 *   intentionSignals: [...],
 *   interestSignals: [...]
 * }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Получаем все активные Discovery signals для EVENT
    const discoverySignals = await prisma.signalDefinition.findMany({
      where: {
        domain: "DISCOVERY",
        isActive: true,
        status: "ACTIVE",
        entityTypes: {
          has: "EVENT",
        },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        parentId: true,
        order: true,
      },
      orderBy: {
        order: "asc",
      },
    });

    // Получаем Profile interests для USER (используются для связи с Event)
    const interestSignals = await prisma.signalDefinition.findMany({
      where: {
        domain: "PROFILE",
        slug: "interests",
        isActive: true,
        status: "ACTIVE",
      },
      select: {
        id: true,
        slug: true,
        title: true,
      },
    });

    // Если есть interests, получаем его опции
    let interestOptions: any[] = [];
    if (interestSignals.length > 0) {
      const interestsId = interestSignals[0].id;
      const options = await prisma.signalOption.findMany({
        where: {
          definitionId: interestsId,
          isActive: true,
        },
        select: {
          value: true,
          label: true,
          order: true,
        },
        orderBy: {
          order: "asc",
        },
      });

      interestOptions = options.map((opt) => ({
        id: `interest-${opt.value}`,
        slug: opt.value,
        title: opt.label,
        parentId: interestsId,
      }));
    }

    // Группируем Discovery signals по родителю
    const activityParent = discoverySignals.find((s) => s.slug === "activity");
    const formatParent = discoverySignals.find((s) => s.slug === "format");

    const activitySignals = activityParent
      ? discoverySignals.filter((s) => s.parentId === activityParent.id)
      : [];

    const formatSignals = formatParent
      ? discoverySignals.filter((s) => s.parentId === formatParent.id)
      : [];

    // Intention signals пока не реализованы в seed, возвращаем пустой массив
    const intentionSignals: any[] = [];

    return NextResponse.json({
      activitySignals,
      formatSignals,
      intentionSignals,
      interestSignals: interestOptions,
    });
  } catch (error) {
    console.error("[available-signals] Error:", error);
    return NextResponse.json(
      { error: "Failed to get available signals" },
      { status: 500 }
    );
  }
}
