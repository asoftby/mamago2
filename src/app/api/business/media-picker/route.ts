import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { checkBusinessToolPermission } from "@/server/permissions/business-permissions";
import { queryMediaPickerPage } from "@/lib/media/mediaPickerQuery";
import { MEDIA_PICKER_PAGE_SIZE } from "@/lib/media/mediaPickerConstants";

/**
 * Медиатека текущего пользователя (курсорная пагинация) — для визарда события/предложения.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!(await checkBusinessToolPermission(user, "content.create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const cursor = searchParams.get("cursor")?.trim() || null;
  const rawLimit = parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(rawLimit) ? rawLimit : MEDIA_PICKER_PAGE_SIZE;

  const page = await queryMediaPickerPage({ uploadedById: user.id, cursor, limit });

  return NextResponse.json({
    items: page.items.map((i) => ({
      id: i.id,
      publicUrl: i.publicUrl,
      alt: i.alt,
      title: i.title,
      sourceType: i.sourceType,
      isUsed: i.isUsed,
      fromEntity: false,
      showImportBadge: false,
    })),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  });
}
