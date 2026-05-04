import { NextResponse } from "next/server";
import { SignalDomain, SignalEntityType, SignalStatus } from "@prisma/client";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export type DiscoverySignalGroup = {
  id: string;
  slug: string;
  title: string;
  icon: string | null;
  order: number;
  options: DiscoverySignalOption[];
};

export type DiscoverySignalOption = {
  id: string;
  label: string;
  value: string;
  order: number;
  active: boolean; // NEW: флаг активности для отображения deprecated
};

/**
 * Public API для получения DISCOVERY сигналов с фильтрацией по entity type
 * 
 * Query params:
 * - entityType: PLACE | EVENT | OFFER | ROUTE | ARTICLE (required)
 * - includeDeprecated: boolean (optional, default=false) - включать deprecated опции для отображения старых значений
 * 
 * Возвращает:
 * - domain = DISCOVERY
 * - entityTypes.includes(entityType)
 * - Если includeDeprecated=false: только status = ACTIVE (для новых выборов)
 * - Если includeDeprecated=true: все status (ACTIVE + DEPRECATED, для отображения старых значений)
 * - Группы сигналов (parent) с их опциями (children)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType");
    const includeDeprecated = url.searchParams.get("includeDeprecated") === "true";

    if (!entityType || !Object.values(SignalEntityType).includes(entityType as SignalEntityType)) {
      return NextResponse.json(
        { error: "Invalid or missing entityType parameter" },
        { status: 400 }
      );
    }

    // Получаем корневые сигналы (группы) для DISCOVERY домена
    const groups = await prisma.signalDefinition.findMany({
      where: {
        domain: SignalDomain.DISCOVERY,
        status: SignalStatus.ACTIVE,
        parentId: null, // только корневые
        entityTypes: {
          has: entityType as SignalEntityType
        }
      },
      include: {
        children: {
          where: includeDeprecated 
            ? { isActive: true } // Для deprecated: все статусы (ACTIVE + DEPRECATED), но только isActive=true
            : {
                status: SignalStatus.ACTIVE,
                isActive: true
              }, // Для новых выборов: только ACTIVE
          orderBy: [{ order: "asc" }, { slug: "asc" }]
        }
      },
      orderBy: [{ order: "asc" }, { slug: "asc" }]
    });

    const result: DiscoverySignalGroup[] = groups.map(group => ({
      id: group.id,
      slug: group.slug,
      title: group.title,
      icon: group.icon,
      order: group.order,
      options: group.children.map(child => ({
        id: child.id,
        label: child.title,
        value: child.slug,
        order: child.order,
        active: child.status === SignalStatus.ACTIVE // NEW: флаг активности
      }))
    }));

    return NextResponse.json({ groups: result });
  } catch (e) {
    console.error("[public/signals/discovery]", e);
    return NextResponse.json(
      { groups: [] as DiscoverySignalGroup[], error: "fetch_failed" },
      { status: 500 }
    );
  }
}
