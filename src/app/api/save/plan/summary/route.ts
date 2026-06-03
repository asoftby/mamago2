import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { listPlanItemsInRange } from "@/server/services/plan.service";

function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

function addDaysIso(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0]!;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const from = params.get("from") ?? todayISO();
  const to = params.get("to") ?? addDaysIso(from, 14);

  if (from > to) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const items = await listPlanItemsInRange(user.id, from, to);
  const countsByDate = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.date] = (acc[item.date] ?? 0) + 1;
    return acc;
  }, {});

  const todayCount = countsByDate[from] ?? 0;
  const weekTo = addDaysIso(from, 6);
  const weekItemsCount = Object.entries(countsByDate).reduce((sum, [date, count]) => {
    if (date >= from && date <= weekTo) return sum + count;
    return sum;
  }, 0);

  const nextPlanItem =
    items.find((item) => item.date > from) == null
      ? null
      : {
          date: items.find((item) => item.date > from)!.date,
          item: {
            title:
              items.find((item) => item.date > from)!.title ??
              items.find((item) => item.date > from)!.activity?.title ??
              null,
          },
        };

  return NextResponse.json({
    todayCount,
    weekItemsCount,
    nextPlanItem,
    countsByDate,
  });
}
