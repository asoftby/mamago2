import type { ActivitySchedulingKind, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSlotScheduleDataComplete } from "@/lib/event/schedulingCompleteness";

export type ActivitySchedulingQuality = "UNKNOWN" | "SLOT_INCOMPLETE" | "COMPLETE";

export function classifyActivitySchedulingQuality(input: {
  schedulingKind: ActivitySchedulingKind | null;
  scheduleJson: unknown;
}): ActivitySchedulingQuality {
  if (input.schedulingKind == null) return "UNKNOWN";
  if (input.schedulingKind === "SLOT" && !isSlotScheduleDataComplete(input.scheduleJson)) {
    return "SLOT_INCOMPLETE";
  }
  return "COMPLETE";
}

/** Explicit admin/operations query; never runs on public page requests. */
export async function getActivitySchedulingQualityCounts(
  client: Pick<PrismaClient, "activity"> = prisma,
) {
  const rows = await client.activity.findMany({ select: { schedulingKind: true, scheduleJson: true } });
  const counts = { total: rows.length, unknown: 0, slotIncomplete: 0, complete: 0 };
  for (const row of rows) {
    const quality = classifyActivitySchedulingQuality(row);
    if (quality === "UNKNOWN") counts.unknown += 1;
    else if (quality === "SLOT_INCOMPLETE") counts.slotIncomplete += 1;
    else counts.complete += 1;
  }
  return counts;
}
