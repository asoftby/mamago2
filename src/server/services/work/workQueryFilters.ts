import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { workListQuerySchema } from "./workSchemas";

/** Explicit status and the overdue exclusion must both apply. */
export function buildWorkItemWhere(
  query: z.infer<typeof workListQuerySchema>, now: Date,
): Prisma.WorkItemWhereInput {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Minsk", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const datePart = (type: "year" | "month" | "day") =>
    parts.find(part => part.type === type)?.value ?? "";
  const start = new Date(`${datePart("year")}-${datePart("month")}-${datePart("day")}T00:00:00+03:00`);
  const end = new Date(start.getTime() + 86_400_000);

  return {
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.openOnly ? {
      AND: [{ status: { notIn: ["DONE", "CANCELED"] as const } }],
    } : {}),
    ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
    // Filter on the server before the LIMIT/OFFSET in listWorkItems.
    ...(query.search ? {
      OR: [
        { title: { contains: query.search, mode: "insensitive" as const } },
        { nextAction: { contains: query.search, mode: "insensitive" as const } },
        { business: { is: { name: { contains: query.search, mode: "insensitive" as const } } } },
        { lead: { is: { name: { contains: query.search, mode: "insensitive" as const } } } },
      ],
    } : {}),
    ...(query.due === "TODAY" ? { dueAt: { gte: start, lt: end } } :
      query.due === "OVERDUE" ? {
        dueAt: { lt: now },
        ...(!query.openOnly ? { AND: [{ status: { notIn: ["DONE", "CANCELED"] as const } }] } : {}),
      } :
      query.due === "UPCOMING" ? {
        // From tomorrow in Minsk (the "Ближайшие задачи" panel excludes today).
        dueAt: { gte: end },
        ...(!query.openOnly ? { AND: [{ status: { notIn: ["DONE", "CANCELED"] as const } }] } : {}),
      } :
      query.due === "NO_DUE" ? { dueAt: null } : {}),
  };
}
