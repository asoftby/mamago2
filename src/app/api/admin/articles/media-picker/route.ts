import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrModerator } from "@/lib/article/requireAdminOrModerator";
import { queryMediaPickerPage } from "@/lib/media/mediaPickerQuery";
import { MEDIA_PICKER_PAGE_SIZE } from "@/lib/media/mediaPickerConstants";

export const runtime = "nodejs";

/**
 * Медиатека автора статьи для выбора обложки/галереи (курсорная пагинация).
 * `authorUserId` доверяем только потому, что маршрут уже требует ADMIN/MODERATOR —
 * без него редакторы не могут видеть чужую медиатеку иначе как через свою.
 */
export async function GET(req: NextRequest) {
  const user = await requireAdminOrModerator();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const authorUserId = searchParams.get("authorUserId")?.trim() || user.id;
  const cursor = searchParams.get("cursor")?.trim() || null;
  const rawLimit = parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(rawLimit) ? rawLimit : MEDIA_PICKER_PAGE_SIZE;

  const page = await queryMediaPickerPage({ uploadedById: authorUserId, cursor, limit });

  return NextResponse.json(page);
}
