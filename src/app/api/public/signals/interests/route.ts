import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

type PublicInterestSignalOption = {
  id: string;
  label: string;
  value: string;
  order: number;
  active: boolean;
};

/**
 * Public read-only «Интересы» signal options for Event Wizard.
 *
 * Source of truth: `SignalDefinition` with slug = "interests".
 */
export async function GET() {
  try {
    const def = await prisma.signalDefinition.findFirst({
      where: { slug: "interests", isActive: true },
      include: {
        options: {
          where: { isActive: true },
          orderBy: [{ order: "asc" }, { value: "asc" }],
        },
      },
    });

    if (!def?.options?.length) {
      return NextResponse.json({ options: [] as PublicInterestSignalOption[] });
    }

    const options: PublicInterestSignalOption[] = def.options.map((o) => ({
      id: o.id,
      label: o.label,
      value: o.value,
      order: o.order,
      active: o.isActive,
    }));

    return NextResponse.json({ options });
  } catch (e) {
    console.error("[public/signals/interests]", e);
    return NextResponse.json(
      { options: [] as PublicInterestSignalOption[], error: "fetch_failed" },
      { status: 200 },
    );
  }
}

