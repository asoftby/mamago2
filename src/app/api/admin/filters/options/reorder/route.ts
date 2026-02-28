import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeFilterOptionOrder } from "@/server/admin/normalizeFilterOptionOrder";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { optionId, direction } = await req.json();

    console.log("Reorder request:", { optionId, direction });

    if (!optionId || !["UP", "DOWN"].includes(direction)) {
      return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    // 1. Get current option
    const current = await prisma.filterOption.findUnique({
      where: { id: optionId },
    });

    console.log("Current option:", current);

    if (!current) {
      return NextResponse.json({ message: "Option not found" }, { status: 404 });
    }

    // Check for duplicates/gaps in orderIndex for this filter
    // Quick check: fetch all orderIndex, if distinct count != total count, normalize
    const siblings = await prisma.filterOption.findMany({
      where: { filterId: current.filterId },
      select: { orderIndex: true },
    });
    
    const uniqueIndexes = new Set(siblings.map(s => s.orderIndex));
    if (uniqueIndexes.size !== siblings.length) {
      console.log("Normalizing indexes before reorder...");
      await normalizeFilterOptionOrder(current.filterId);
      
      // Refetch current after normalization
      const updatedCurrent = await prisma.filterOption.findUnique({ where: { id: optionId } });
      if (updatedCurrent) {
        current.orderIndex = updatedCurrent.orderIndex;
      }
    }

    // 2. Find swap target within the same filter
    let target;
    if (direction === "UP") {
      target = await prisma.filterOption.findFirst({
        where: {
          filterId: current.filterId,
          orderIndex: { lt: current.orderIndex },
        },
        orderBy: { orderIndex: "desc" },
      });
    } else {
      target = await prisma.filterOption.findFirst({
        where: {
          filterId: current.filterId,
          orderIndex: { gt: current.orderIndex },
        },
        orderBy: { orderIndex: "asc" },
      });
    }

    console.log("Target option:", target);

    if (!target) {
      console.log("No target found, skipping swap");
      // Already at top/bottom, no op
      return NextResponse.json({ ok: true });
    }

    // 3. Swap orderIndex in transaction
    await prisma.$transaction([
      prisma.filterOption.update({
        where: { id: current.id },
        data: { orderIndex: target.orderIndex },
      }),
      prisma.filterOption.update({
        where: { id: target.id },
        data: { orderIndex: current.orderIndex },
      }),
    ]);
    
    console.log("Swap successful");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Option reorder failed:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
