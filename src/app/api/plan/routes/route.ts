import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { addRoutePlanItem } from "@/server/services/plan.service";

const bodySchema = z.object({
  routeId: z.string().min(1),
  routeSlug: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Для демо-маршрута без записи в БД */
  title: z.string().optional(),
  coverImageUrl: z.string().max(4000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const { routeId, routeSlug, date, title, coverImageUrl } = bodySchema.parse(json);

    const planItem = await addRoutePlanItem(user.id, routeId, date, routeSlug, {
      title,
      coverImageUrl,
    });

    return NextResponse.json({ success: true, planItem });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Некорректные данные", details: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "Route not found") {
      return NextResponse.json({ error: "Маршрут не найден" }, { status: 404 });
    }
    console.error("[api/plan/routes]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
