/**
 * Direct complaints: moderator/reporter notifications and the resolve guard.
 * Needs disposable localhost PostgreSQL and `--conditions=react-server`:
 *   NODE_OPTIONS=--conditions=react-server npx tsx src/server/services/direct/directComplaint.postgres.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { BookingStatus, DirectComplaintStatus, PublicationType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { openBusinessDirectThreadForBooking } from "./directBookingThread.service";
import { createComplaint, DirectComplaintError, resolveComplaint } from "./directComplaint.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Direct complaint tests require disposable localhost PostgreSQL");
}

const sfx = randomUUID().slice(0, 10);
const id = (name: string) => `dcp-${name}-${sfx}`;
const admin = id("admin");
const moderator = id("moderator");
const customer = id("customer");
const owner = id("owner");
const bystander = id("bystander");
const users = [admin, moderator, customer, owner, bystander];
let businessId = "";
let activityId = "";
let threadId = "";
let threadNumber = 0;
const bookingIds: string[] = [];
// Opened-notices go to EVERY admin/moderator in the database (not just the fixtures),
// so teardown also removes them by complaint id.
const complaintIds: string[] = [];
async function fileComplaint(input: Parameters<typeof createComplaint>[0]) {
  const complaint = await createComplaint(input);
  complaintIds.push(complaint.id);
  return complaint;
}

before(async () => {
  await prisma.user.createMany({
    data: [
      { id: admin, email: `${admin}@example.test`, role: "ADMIN" },
      { id: moderator, email: `${moderator}@example.test`, role: "MODERATOR" },
      { id: customer, email: `${customer}@example.test` },
      { id: owner, email: `${owner}@example.test` },
      { id: bystander, email: `${bystander}@example.test` },
    ],
  });
  businessId = (await prisma.business.create({ data: { name: "DCP biz " + sfx, ownerUserId: owner } })).id;
  await prisma.businessMember.create({ data: { businessId, userId: owner, role: "OWNER", isActive: true } });
  activityId = (
    await prisma.activity.create({
      data: { ownerUserId: owner, businessId, title: "DCP event " + sfx, shortDesc: "x", type: "EVENT", scheduleMode: "ALWAYS" },
    })
  ).id;
  const booking = await prisma.bookingRequest.create({
    data: {
      businessId, publicationType: PublicationType.EVENT, activityId, customerName: "Тест",
      customerPhone: "+375291112233", status: BookingStatus.NEW, userId: customer,
    },
  });
  bookingIds.push(booking.id);
  const opened = await openBusinessDirectThreadForBooking({ bookingRequestId: booking.id, actorUserId: owner, message: "Привет" });
  threadId = opened.threadId;
  threadNumber = opened.threadNumber;
});

// Notifications and their delivery rows are written in the background; wait for
// them before asserting/cleaning up so teardown never races them (40P01).
async function waitFor(label: string, done: () => Promise<boolean>) {
  const deadline = Date.now() + 15_000;
  while (!(await done())) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
async function deliveriesSettled() {
  const rows = await prisma.notification.findMany({
    where: { userId: { in: users } },
    select: { deliveries: { select: { status: true } } },
  });
  return rows.every(({ deliveries }) => deliveries.length > 0 && deliveries.every(({ status }) => status !== "PENDING"));
}

after(async () => {
  await waitFor("deliveries to settle", deliveriesSettled);
  await prisma.notification.deleteMany({ where: { entityId: { in: complaintIds } } });
  await prisma.directRiskSignal.deleteMany({ where: { businessId } });
  await prisma.directComplaint.deleteMany({ where: { threadId } });
  await prisma.directMessage.deleteMany({ where: { threadId } });
  await prisma.directThread.deleteMany({ where: { id: threadId } });
  await prisma.notification.deleteMany({ where: { userId: { in: users } } });
  await prisma.bookingRequest.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.activity.deleteMany({ where: { id: activityId } });
  await prisma.businessMember.deleteMany({ where: { userId: { in: users } } });
  await prisma.business.deleteMany({ where: { id: businessId } });
  await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: users } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});

const notificationsFor = (type: "DIRECT_COMPLAINT_OPENED" | "DIRECT_COMPLAINT_RESOLVED", entityId: string) =>
  prisma.notification.findMany({ where: { type, entityId, userId: { in: users } } });

test("new complaint notifies every admin and moderator, nobody else", async () => {
  const complaint = await fileComplaint({ threadId, reporterUserId: customer, reason: "SPAM", comment: "тест" });
  await waitFor("opened notifications", async () => (await notificationsFor("DIRECT_COMPLAINT_OPENED", complaint.id)).length >= 2);
  const rows = await notificationsFor("DIRECT_COMPLAINT_OPENED", complaint.id);
  assert.deepEqual(rows.map((n) => n.userId).sort(), [admin, moderator].sort());
  assert.ok(rows.every((n) => n.audience === "ADMIN" && n.ctaAction?.includes("/communications/direct/complaints")));
  assert.ok(rows.every((n) => n.title.includes(`D-${threadNumber}`) && n.body.includes("Спам")));
});

test("resolving notifies the customer reporter once, without the internal note; a second resolve is rejected", async () => {
  const complaint = await fileComplaint({ threadId, reporterUserId: customer, reason: "ABUSE" });
  const note = "Внутренняя заметка модератора " + sfx;
  const resolved = await resolveComplaint({
    complaintId: complaint.id, reviewedByUserId: moderator, actorRole: "MODERATOR",
    status: DirectComplaintStatus.ACTION_TAKEN, resolution: note,
  });
  assert.equal(resolved.status, DirectComplaintStatus.ACTION_TAKEN);
  await waitFor("resolved notification", async () => (await notificationsFor("DIRECT_COMPLAINT_RESOLVED", complaint.id)).length >= 1);

  await assert.rejects(
    resolveComplaint({
      complaintId: complaint.id, reviewedByUserId: admin, actorRole: "ADMIN",
      status: DirectComplaintStatus.DISMISSED, resolution: "второй раз",
    }),
    (e: unknown) => e instanceof DirectComplaintError && e.code === "ALREADY_RESOLVED",
  );
  const rows = await notificationsFor("DIRECT_COMPLAINT_RESOLVED", complaint.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].userId, customer);
  assert.equal(rows[0].audience, "USER");
  assert.equal(rows[0].ctaAction, `/me/direct/${threadId}`);
  assert.ok(!rows[0].body.includes(note) && !rows[0].title.includes(note));
  // The first decision stands.
  assert.equal((await prisma.directComplaint.findUniqueOrThrow({ where: { id: complaint.id } })).status, DirectComplaintStatus.ACTION_TAKEN);
});

test("a business-side reporter is answered in the business cabinet", async () => {
  const complaint = await fileComplaint({ threadId, reporterUserId: owner, reason: "SCAM" });
  await resolveComplaint({
    complaintId: complaint.id, reviewedByUserId: admin, actorRole: "ADMIN",
    status: DirectComplaintStatus.DISMISSED, resolution: "Нарушений нет",
  });
  await waitFor("resolved notification", async () => (await notificationsFor("DIRECT_COMPLAINT_RESOLVED", complaint.id)).length >= 1);
  const [row] = await notificationsFor("DIRECT_COMPLAINT_RESOLVED", complaint.id);
  assert.equal(row.userId, owner);
  assert.equal(row.audience, "BUSINESS");
  assert.equal(row.ctaAction, `/business/direct/${threadId}`);
});

test("resolving an unknown complaint is NOT_FOUND, not a server error", async () => {
  await assert.rejects(
    resolveComplaint({
      complaintId: "missing-" + sfx, reviewedByUserId: admin, actorRole: "ADMIN",
      status: DirectComplaintStatus.REVIEWED, resolution: "x",
    }),
    (e: unknown) => e instanceof DirectComplaintError && e.code === "NOT_FOUND",
  );
  assert.equal(await prisma.notification.count({ where: { userId: bystander } }), 0);
});
