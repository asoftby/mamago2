// Демо-данные для проверки единого инбокса /business/bookings (все 4 раздела).
//   DATABASE_URL=<изолированная локальная БД> npx tsx scripts/dev/seed-business-inbox-demo.ts
// Работает только с localhost PostgreSQL. Логин: inbox-demo@mamago.local / InboxDemo-12345
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !["127.0.0.1", "localhost"].includes(new URL(dbUrl).hostname)) {
  throw new Error("seed-business-inbox-demo works only against a localhost PostgreSQL DATABASE_URL");
}
const db = new PrismaClient();
const DAY = 86_400_000;
const now = Date.now();
const at = (days: number, hour = 12) => {
  const d = new Date(now + days * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};
const dateOnly = (days: number) => new Date(new Date(now + days * DAY).toISOString().slice(0, 10) + "T00:00:00Z");

async function main() {
  const email = "inbox-demo@mamago.local";
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email, role: "BUSINESS_OWNER", emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash("InboxDemo-12345", 10),
    },
  });
  const business = await db.business.upsert({
    where: { ownerUserId: user.id },
    update: {},
    create: {
      ownerUserId: user.id, name: "Демо-студия", status: "APPROVED",
      verificationStatus: "APPROVED", isVerified: true,
    },
  });
  await db.businessMember.upsert({
    where: { businessId_userId: { businessId: business.id, userId: user.id } },
    update: {},
    create: { businessId: business.id, userId: user.id, role: "OWNER" },
  });
  const parent = await db.user.upsert({
    where: { email: "inbox-parent@mamago.local" }, update: {},
    create: { email: "inbox-parent@mamago.local", role: "USER" },
  });
  // Перезапуск: чистим только заявки этого демо-бизнеса.
  await db.partyOrder.deleteMany({ where: { ownerUserId: parent.id } });
  await db.bookingRequest.deleteMany({ where: { businessId: business.id } });
  await db.place.deleteMany({ where: { createdByUserId: user.id } });
  const place = await db.place.create({
    data: { title: "Студия «Радуга»", createdByUserId: user.id, status: "PUBLISHED", shortDesc: "Демо" } as never,
  });

  const standard = (over: Record<string, unknown>) => db.bookingRequest.create({
    data: {
      businessId: business.id, userId: parent.id, publicationType: "PLACE", placeId: place.id,
      customerName: "Анна", customerPhone: "+375291112233", ...over,
    } as never,
  });
  await standard({ status: "NEW", requestedDate: dateOnly(5), requestedTime: "15:00" });
  await standard({ status: "CONFIRMED", requestedDate: dateOnly(-3), requestedTime: "11:00", firstResponseAt: at(-6) });
  await standard({ status: "CONFIRMED", requestedDate: dateOnly(7), requestedTime: "16:30", firstResponseAt: at(-1) });
  await standard({ status: "COMPLETED", requestedDate: dateOnly(-20), completedAt: at(-19) });

  const party = async (
    stage: string, status: string, eventDays: number,
    opts: { due?: Date; quote?: { status: string; validUntil: Date } } = {},
  ) => {
    const order = await db.partyOrder.create({
      data: {
        ownerUserId: parent.id, citySlug: "minsk", venueMode: "VENUE", status: "ANCHOR_PENDING",
        eventDate: dateOnly(eventDays), timeFrom: "14:00", timeTo: "17:00", childrenCount: 8,
      } as never,
    });
    const item = await db.partyOrderItem.create({
      data: { partyOrderId: order.id, category: "VENUE", businessId: business.id, role: "ANCHOR" } as never,
    });
    const req = await db.bookingRequest.create({
      data: {
        businessId: business.id, userId: parent.id, publicationType: "PLACE", placeId: place.id,
        kind: "PARTY", partyOrderItemId: item.id, partyStage: stage, status, responseDueAt: opts.due ?? null,
      } as never,
    });
    if (opts.quote) {
      await db.partyQuote.create({
        data: {
          bookingRequestId: req.id, version: 1, type: "AS_REQUESTED", priceByn: 450, includes: "Зал, аниматор",
          validUntil: opts.quote.validUntil, status: opts.quote.status, respondedByUserId: user.id,
          idempotencyKey: `seed_${req.id}`,
        } as never,
      });
    }
  };
  await party("SENT", "NEW", 10, { due: at(2) });
  await party("QUOTED", "NEW", 6, { quote: { status: "ACTIVE", validUntil: new Date(now - 2 * 3_600_000) } });
  await party("QUOTED", "NEW", 8, { quote: { status: "ACTIVE", validUntil: new Date(now + 20 * 3_600_000) } });
  await party("CONFIRMED", "CONFIRMED", 12);
  await party("DECLINED", "REJECTED", 9);
  console.log("seeded business inbox demo:", business.id);
}
main().finally(() => db.$disconnect());
