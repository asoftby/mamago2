import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { materializeRecurrencesForRange } from "./recurrenceMaterialization.service";
import { loadFamilyCalendarRange } from "./familyCalendar.service";

// This test creates and modifies data. Refuse to run outside its disposable DB.
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (url.hostname !== "127.0.0.1" || url.port !== "55444" ||
    url.pathname !== "/mamago_plan_recurrence_it") {
  throw new Error("SAFE ABORT: isolated plan recurrence DB only");
}
if (process.env.FAMILY_CORE_READS !== "true") {
  throw new Error("SAFE ABORT: FAMILY_CORE_READS must be true for ACL coverage");
}

const from = "2026-10-29";
const to = "2026-11-04";
const cancelDate = "2026-11-01";

async function run() {
  const [owner, member, outsider] = await Promise.all([
    prisma.user.create({ data: { email: "recurrence-owner@it.test" } }),
    prisma.user.create({ data: { email: "recurrence-member@it.test" } }),
    prisma.user.create({ data: { email: "recurrence-outsider@it.test" } }),
  ]);
  const [family, otherFamily] = await Promise.all([
    prisma.family.create({ data: { name: "Recurring task test family" } }),
    prisma.family.create({ data: { name: "Unrelated test family" } }),
  ]);
  await prisma.familyMembership.createMany({ data: [
    { userId: owner.id, familyId: family.id, role: "OWNER" },
    { userId: member.id, familyId: family.id, role: "ADULT" },
    { userId: outsider.id, familyId: otherFamily.id, role: "OWNER" },
  ] });

  async function series(args: {
    userId: string; familyId: string; visibility: "FAMILY" | "PRIVATE";
    title: string; stopped?: boolean;
  }) {
    return prisma.planRecurrenceSeries.create({
      data: {
        ownerUserId: args.userId,
        familyId: args.familyId,
        visibility: args.visibility,
        frequency: "DAILY",
        interval: 1,
        startDate: from,
        stoppedAt: args.stopped ? new Date() : null,
        template: { title: args.title, time: "17:30", reminderEnabled: true, lead: 60 },
      },
    });
  }

  const [shared, ownerPrivate, memberPrivate, stopped, unrelated] = await Promise.all([
    series({ userId: owner.id, familyId: family.id, visibility: "FAMILY", title: "shared" }),
    series({ userId: owner.id, familyId: family.id, visibility: "PRIVATE", title: "owner-private" }),
    series({ userId: member.id, familyId: family.id, visibility: "PRIVATE", title: "member-private" }),
    series({ userId: owner.id, familyId: family.id, visibility: "FAMILY", title: "stopped", stopped: true }),
    series({ userId: outsider.id, familyId: otherFamily.id, visibility: "FAMILY", title: "outsider" }),
  ]);

  // Cancellation is a durable tombstone, protected by the existing unique key.
  const cancelled = await prisma.planItem.create({ data: {
    userId: owner.id, familyId: family.id, visibility: "FAMILY",
    source: "MANUAL", entryType: "TASK", title: "cancelled",
    date: cancelDate, recurrenceSeriesId: shared.id, recurrenceDate: cancelDate,
    status: "CANCELLED", cancelledAt: new Date(),
  } });

  // Concurrent calendar reads must be retry-safe in real PostgreSQL.
  const concurrent = await Promise.allSettled(Array.from({ length: 8 }, (_, index) =>
    loadFamilyCalendarRange({ owner: { userId: index % 2 ? member.id : owner.id }, from, to })));
  assert.ok(concurrent.every(result => result.status === "fulfilled"),
    "Concurrent calendar requests must succeed: " + JSON.stringify(concurrent.filter(x => x.status === "rejected")));

  const sharedRows = await prisma.planItem.findMany({
    where: { recurrenceSeriesId: shared.id }, orderBy: { recurrenceDate: "asc" },
  });
  assert.equal(sharedRows.length, 7, "One durable occurrence per day, including cancellation");
  assert.equal(new Set(sharedRows.map(row => row.recurrenceDate)).size, 7);
  assert.equal(sharedRows.find(row => row.recurrenceDate === cancelDate)?.id, cancelled.id);
  assert.equal(sharedRows.find(row => row.recurrenceDate === cancelDate)?.status, "CANCELLED");
  assert.equal(await prisma.planItem.count({ where: { recurrenceSeriesId: stopped.id } }), 0);
  assert.equal(await prisma.planItem.count({ where: { recurrenceSeriesId: unrelated.id } }), 0);
  assert.equal(await prisma.planItem.count({ where: { recurrenceSeriesId: ownerPrivate.id } }), 7);
  assert.equal(await prisma.planItem.count({ where: { recurrenceSeriesId: memberPrivate.id } }), 7);

  const memberCalendar = await loadFamilyCalendarRange({ owner: { userId: member.id }, from, to });
  assert.ok(memberCalendar.items.some(item => item.title === "shared"));
  assert.ok(memberCalendar.items.some(item => item.title === "member-private"));
  assert.ok(memberCalendar.items.every(item => item.title !== "owner-private" && item.title !== "outsider"));
  const ownerCalendar = await loadFamilyCalendarRange({ owner: { userId: owner.id }, from, to });
  assert.ok(ownerCalendar.items.some(item => item.title === "owner-private"));
  assert.ok(ownerCalendar.items.every(item => item.title !== "member-private"));
  assert.ok(ownerCalendar.items.every(item => item.title !== "stopped"));
  assert.ok(ownerCalendar.items.every(item => item.status !== "CANCELLED"));
  const outsiderCalendar = await loadFamilyCalendarRange({ owner: { userId: outsider.id }, from, to });
  assert.ok(outsiderCalendar.items.every(item => item.title !== "shared" && item.title !== "owner-private"));
  assert.ok(outsiderCalendar.items.some(item => item.title === "outsider"));

  // Edited occurrence is not overwritten when the same week is read again.
  const edited = sharedRows.find(row => row.recurrenceDate === "2026-11-02");
  assert.ok(edited);
  await prisma.planItem.update({ where: { id: edited.id }, data: { title: "edited occurrence" } });
  await Promise.all([
    materializeRecurrencesForRange({ userId: owner.id }, from, to),
    materializeRecurrencesForRange({ userId: member.id }, from, to),
  ]);
  assert.equal((await prisma.planItem.findUniqueOrThrow({ where: { id: edited.id } })).title, "edited occurrence");
  assert.equal(await prisma.planItem.count({ where: { recurrenceSeriesId: shared.id } }), 7);
  assert.equal(await prisma.planItem.count({ where: { recurrenceSeriesId: stopped.id } }), 0);

  console.log("PASS concurrent recurrence materialization, family/private ACL, stopped/cancelled/edited occurrences");
}

run().finally(() => prisma.$disconnect());
