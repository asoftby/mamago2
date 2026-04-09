import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { addRouteIdea } from "@/server/services/idea.service";

const bodySchema = z.object({
  routeId: z.string().min(1),
  routeSlug: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const { routeId, routeSlug } = bodySchema.parse(json);

    const row = await addRouteIdea(user.id, routeId, routeSlug);

    return NextResponse.json({ success: true, idea: row });
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
    console.error("[api/ideas/routes]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
