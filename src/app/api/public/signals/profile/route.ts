import { NextResponse } from "next/server";
import { SignalDomain, SignalStatus } from "@prisma/client";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

export type ProfileSignalGroup = {
  id: string;
  slug: string;
  title: string;
  icon: string | null;
  order: number;
  options: ProfileSignalOption[];
};

export type ProfileSignalOption = {
  id: string;
  label: string;
  value: string;
  order: number;
  active: boolean; // NEW: флаг активности для отображения deprecated
};

/**
 * Public API для получения PROFILE сигналов
 * 
 * Query params:
 * - includeDeprecated: boolean (optional, default=false) - включать deprecated опции для отображения старых значений
 * 
 * Возвращает:
 * - domain = PROFILE
 * - Если includeDeprecated=false: только status = ACTIVE (для новых выборов)
 * - Если includeDeprecated=true: все status (ACTIVE + DEPRECATED, для отображения старых значений)
 * - Группы сигналов (parent) с их опциями (children или SignalOptions)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const includeDeprecated = url.searchParams.get("includeDeprecated") === "true";

    // Получаем корневые сигналы (группы) для PROFILE домена
    const groups = await prisma.signalDefinition.findMany({
      where: {
        domain: SignalDomain.PROFILE,
        status: SignalStatus.ACTIVE,
        parentId: null, // только корневые
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
        },
        options: {
          where: includeDeprecated
            ? { isActive: true } // Для deprecated: все статусы (ACTIVE + DEPRECATED), но только isActive=true
            : {
                isActive: true
              }, // Для новых выборов: только активные
          orderBy: [{ order: "asc" }, { value: "asc" }]
        }
      },
      orderBy: [{ order: "asc" }, { slug: "asc" }]
    });

    const result: ProfileSignalGroup[] = groups.map(group => {
      // Если есть children (под-сигналы), используем их
      if (group.children.length > 0) {
        return {
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
        };
      }
      
      // Иначе используем options (SignalOption)
      return {
        id: group.id,
        slug: group.slug,
        title: group.title,
        icon: group.icon,
        order: group.order,
        options: group.options.map(option => ({
          id: option.id,
          label: option.label,
          value: option.value,
          order: option.order,
          active: true // SignalOption не имеет статуса, поэтому всегда active
        }))
      };
    });

    return NextResponse.json({ groups: result });
  } catch (e) {
    console.error("[public/signals/profile]", e);
    return NextResponse.json(
      { groups: [] as ProfileSignalGroup[], error: "fetch_failed" },
      { status: 500 }
    );
  }
}
