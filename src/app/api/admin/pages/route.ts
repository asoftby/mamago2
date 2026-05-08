import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { listPages, createPage } from "@/lib/pages/service";
import { ListPagesQuerySchema, CreatePageSchema } from "@/lib/pages/validation";

/**
 * GET /api/admin/pages
 * Получение списка страниц с фильтрацией и пагинацией
 */
export async function GET(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const parsed = ListPagesQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await listPages(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin/pages GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch pages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pages
 * Создание новой страницы
 */
export async function POST(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = CreatePageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const page = await createPage(parsed.data, user.id);
    return NextResponse.json(page, { status: 201 });
  } catch (error) {
    console.error("[admin/pages POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create page" },
      { status: 400 }
    );
  }
}
