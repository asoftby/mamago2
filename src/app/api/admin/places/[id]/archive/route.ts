import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  archivePlace,
  PlaceArchiveError,
  unarchivePlace,
} from "@/server/services/placeArchive.service";

function responseFromArchiveError(error: unknown) {
  if (error instanceof PlaceArchiveError) {
    return NextResponse.json(
      { code: error.code, message: error.message },
      { status: error.statusCode },
    );
  }

  return NextResponse.json(
    { code: "PLACE_ARCHIVE_FAILED", message: "Не удалось выполнить действие" },
    { status: 500 },
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const place = await archivePlace(id, { id: user.id, role: user.role });

    return NextResponse.json({
      success: true,
      place: {
        id: place.id,
        archivedAt: place.archivedAt,
      },
    });
  } catch (error) {
    console.error("[admin] Archive place error:", error);
    return responseFromArchiveError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const place = await unarchivePlace(id, { id: user.id, role: user.role });

    return NextResponse.json({
      success: true,
      place: {
        id: place.id,
        archivedAt: place.archivedAt,
      },
    });
  } catch (error) {
    console.error("[admin] Restore place error:", error);
    return responseFromArchiveError(error);
  }
}
