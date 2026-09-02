import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  archiveOffer,
  OfferArchiveError,
  unarchiveOffer,
} from "@/server/services/offerArchive.service";

function responseFromArchiveError(error: unknown) {
  if (error instanceof OfferArchiveError) {
    return NextResponse.json(
      { code: error.code, message: error.message },
      { status: error.statusCode },
    );
  }
  return NextResponse.json(
    { code: "OFFER_ARCHIVE_FAILED", message: "Не удалось выполнить действие" },
    { status: 500 },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      archiveReason?: string | null;
    };
    const { id } = await params;
    const offer = await archiveOffer({
      offerId: id,
      actor: { id: user.id, role: user.role },
      archiveReason: body.archiveReason,
    });

    return NextResponse.json({
      success: true,
      offer: { id: offer.id, status: offer.status, archivedAt: offer.archivedAt },
    });
  } catch (error) {
    console.error("[business] Archive offer error:", error);
    return responseFromArchiveError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const offer = await unarchiveOffer(id, { id: user.id, role: user.role });
    return NextResponse.json({
      success: true,
      offer: { id: offer.id, status: offer.status, archivedAt: offer.archivedAt },
    });
  } catch (error) {
    console.error("[business] Restore offer error:", error);
    return responseFromArchiveError(error);
  }
}
