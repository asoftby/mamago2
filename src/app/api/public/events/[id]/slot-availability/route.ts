import { NextResponse } from "next/server";
import { getEventSlotAvailability } from "@/server/services/booking/eventSlotAvailability";

/**
 * Read-only seats left per time slot, fetched when the booking window opens
 * (not on every page view). Never a reservation: the booking write path
 * re-checks capacity transactionally.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const slots = await getEventSlotAvailability(id);
  if (!slots) return NextResponse.json({ error: "Событие недоступно для записи" }, { status: 404 });
  return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store" } });
}
