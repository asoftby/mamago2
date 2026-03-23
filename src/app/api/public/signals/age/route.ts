import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { PublicAgeSignalOption } from "@/features/birthday/builder/lib/ageSignalMapper";
import { resolveAgeBoundsFromSignalValue } from "@/features/birthday/builder/lib/ageSignalMapper";

export const runtime = "nodejs";

/**
 * Public read-only age signal options for Birthday Builder (taxonomy source of truth).
 */
export async function GET() {
  try {
    const def = await prisma.signalDefinition.findFirst({
      where: { slug: "age", isActive: true },
      include: {
        options: {
          where: { isActive: true },
          orderBy: [{ order: "asc" }, { value: "asc" }],
        },
      },
    });

    if (!def?.options?.length) {
      return NextResponse.json({ options: [] as PublicAgeSignalOption[] });
    }

    const options: PublicAgeSignalOption[] = def.options.map((o) => {
      const { minAge, maxAge } = resolveAgeBoundsFromSignalValue(o.value);
      return {
        id: o.id,
        label: o.label,
        value: o.value,
        order: o.order,
        active: o.isActive,
        minAge,
        maxAge,
        weight: 1,
      };
    });

    return NextResponse.json({ options });
  } catch (e) {
    console.error("[public/signals/age]", e);
    return NextResponse.json({ options: [] as PublicAgeSignalOption[], error: "fetch_failed" }, { status: 200 });
  }
}
