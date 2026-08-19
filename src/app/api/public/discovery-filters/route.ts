import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { SecondaryFilterGroup } from "@/lib/discovery/filterConfigByIntent";
import type { Intent } from "@/lib/intent";
import { isExecutableAdminFilterKey } from "@/lib/discovery/executableFilterRegistry";

export const runtime = "nodejs";

function isIntent(value: string): value is Intent {
  return value === "kuda" || value === "classes" || value === "birthday" || value === "routes";
}

/**
 * GET /api/public/discovery-filters?intent=kuda
 *
 * Returns SecondaryFilterGroup[] for the given intent from the DB
 * (DiscoveryFilterPlacement → FilterDefinition → FilterOption).
 * This is the single source of truth for what filters appear in the public modal.
 * The admin panel at /admin/discovery/filters manages these placements.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const intent = searchParams.get("intent");

  if (!intent || !isIntent(intent)) {
    return NextResponse.json({ error: "intent required" }, { status: 400 });
  }

  const placements = await prisma.discoveryFilterPlacement.findMany({
    where: {
      intent,
      categoryId: null,
      isActive: true,
    },
    orderBy: { sortOrder: "asc" },
    include: {
      filter: {
        include: {
          options: {
            where: { isActive: true },
            orderBy: { orderIndex: "asc" },
          },
        },
      },
    },
  });

  const groups: SecondaryFilterGroup[] = placements
    .filter((p) => p.filter.isActive && isExecutableAdminFilterKey(intent as Intent, p.filter.slug))
    .map((p) => {
      const f = p.filter;
      const ui = f.ui as SecondaryFilterGroup["ui"];

      if (f.type === "boolean") {
        const trueOpt = f.options.find((o) => o.value === "true");
        return {
          id: f.slug,
          label: f.title,
          kind: "boolean" as const,
          ui,
          showTitle: f.showTitle,
          trueLabel: trueOpt?.label ?? f.title,
        };
      }

      // Normalise legacy "multi" stored in old records → "multiple"
      const kind = (f.type === "multi" ? "multiple" : f.type) as "single" | "multiple";
      return {
        id: f.slug,
        label: f.title,
        kind,
        ui,
        showTitle: f.showTitle,
        options: f.options.map((o) => ({ id: o.value, label: o.label })),
      };
    });

  return NextResponse.json(groups);
}
