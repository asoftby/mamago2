import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
const noStore = { "Cache-Control": "private, no-store" };
async function requireOwner() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Требуется вход");
  const business = await getMyBusiness(user.id);
  if (!business || business.operationalStatus !== "ACTIVE")
    throw new ApiError(403, "Бизнес недоступен");
  return business.id;
}
function responseFor(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("[booking-block] failed", error);
  return NextResponse.json({ error: "Ошибка управления блокировкой" }, { status: 500 });
}
async function assertOwnedUnit(id: string, owner: string) {
  const unit = await prisma.bookingUnit.findFirst({ where: { id, businessId: owner }, select: { id: true } });
  if (!unit) throw new ApiError(404, "Ресурс не найден");
}
const blockSchema = z.object({
  blockStart: z.string().datetime({ offset: true }),
  blockEnd: z.string().datetime({ offset: true }),
  note: z.string().trim().max(500).nullable().optional(),
}).strict();

/** Returns occupied windows without customer details. */
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const owner = await requireOwner();
    const { id } = await params;
    await assertOwnedUnit(id, owner);
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(start.getTime() + 31 * 86400000);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
      end <= start || end.getTime() - start.getTime() > 93 * 86400000)
      throw new ApiError(422, "Период должен быть не длиннее 93 дней");
    const [blocks, allocations] = await Promise.all([
      prisma.calendarBlock.findMany({
        where: { bookingUnitId: id, blockStart: { lt: end }, blockEnd: { gt: start } },
        select: { id: true, blockStart: true, blockEnd: true, source: true, note: true },
        orderBy: { blockStart: "asc" },
      }),
      prisma.bookingAllocation.findMany({
        where: { bookingUnitId: id, blockStart: { lt: end }, blockEnd: { gt: start },
          OR: [{ status: "CONFIRMED" }, { status: "HELD", expiresAt: { gt: new Date() } }] },
        select: { blockStart: true, blockEnd: true, status: true },
        orderBy: { blockStart: "asc" },
      }),
    ]);
    return NextResponse.json({ blocks, allocations }, { headers: noStore });
  } catch (error) { return responseFor(error); }
}

/** Lock the same BookingUnit row as party confirmation before inserting a manual block. */
export async function POST(request: NextRequest, { params }: Context) {
  try {
    const owner = await requireOwner();
    const { id } = await params;
    const parsed = blockSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError(422, "Некорректный интервал блокировки");
    const start = new Date(parsed.data.blockStart);
    const end = new Date(parsed.data.blockEnd);
    const now = new Date();
    if (start <= now || end <= start || end.getTime() - start.getTime() > 31 * 86400000)
      throw new ApiError(422, "Интервал должен быть в будущем, не длиннее 31 дня");
    const block = await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "BookingUnit"
        WHERE "id" = ${id} AND "businessId" = ${owner} FOR UPDATE
      `;
      if (locked.length !== 1) throw new ApiError(404, "Ресурс не найден");
      const occupied = await tx.bookingAllocation.findFirst({
        where: { bookingUnitId: id, blockStart: { lt: end }, blockEnd: { gt: start },
          OR: [{ status: "CONFIRMED" }, { status: "HELD", expiresAt: { gt: now } }] },
        select: { id: true },
      });
      const blocked = await tx.calendarBlock.findFirst({
        where: { bookingUnitId: id, blockStart: { lt: end }, blockEnd: { gt: start } },
        select: { id: true },
      });
      if (occupied || blocked) throw new ApiError(409, "Время уже занято или закрыто");
      return tx.calendarBlock.create({
        data: { bookingUnitId: id, blockStart: start, blockEnd: end, source: "MANUAL",
          note: parsed.data.note ?? null },
        select: { id: true, blockStart: true, blockEnd: true },
      });
    });
    return NextResponse.json({ block }, { status: 201, headers: noStore });
  } catch (error) { return responseFor(error); }
}

/** Only explicitly manual blocks can be removed, without touching reservations. */
export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const owner = await requireOwner();
    const { id } = await params;
    const input = z.object({ blockId: z.string().min(1) }).strict().safeParse(await request.json().catch(() => null));
    if (!input.success) throw new ApiError(422, "Некорректная блокировка");
    const removed = await prisma.calendarBlock.deleteMany({
      where: { id: input.data.blockId, bookingUnitId: id, source: "MANUAL",
        bookingUnit: { businessId: owner } },
    });
    if (removed.count !== 1) throw new ApiError(404, "Ручная блокировка не найдена");
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) { return responseFor(error); }
}
