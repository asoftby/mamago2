import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { getPageById, updatePage, archivePage } from "@/lib/pages/service";
import { UpdatePageSchema } from "@/lib/pages/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/admin/pages/[id]
 * Получение страницы по ID
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const page = await getPageById(id);

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json(page);
  } catch (error) {
    console.error("[admin/pages/[id] GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch page" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/pages/[id]
 * Обновление страницы
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdatePageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const page = await updatePage(id, parsed.data, user.id);
    return NextResponse.json(page);
  } catch (error) {
    console.error("[admin/pages/[id] PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update page" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/pages/[id]
 * Soft delete (архивирование) страницы
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const page = await archivePage(id, user.id);
    return NextResponse.json(page);
  } catch (error) {
    console.error("[admin/pages/[id] DELETE]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive page" },
      { status: 400 }
    );
  }
}
