import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import prisma from "@/lib/prisma";
import { archiveNotification, countUserArchived, getUnreadCount, getUserArchived, getUserInbox, resolveNotificationActionById } from "./notification.service";

assert.ok(["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL ?? "http://invalid").hostname), "Disposable local PostgreSQL required");

test("unread bell is newest first for user/business/admin, read and archive preserve history and booking", async () => {
  const user = await prisma.user.create({ data: { email: "bell-" + randomUUID() + "@example.test" } });
  const foreign = await prisma.user.create({ data: { email: "bell-foreign-" + randomUUID() + "@example.test" } });
  const business = await prisma.business.create({ data: { name: "Synthetic bell business", ownerUserId: user.id } });
  const booking = await prisma.bookingRequest.create({ data: { businessId: business.id, publicationType: "OFFER", customerName: "Synthetic", customerPhone: "+375291112233", status: "NEW" } });
  try {
    for (const audience of ["USER", "BUSINESS", "ADMIN"] as const) {
      const options = { accessibleSurfaces: [audience] };
      const older = await prisma.notification.create({ data: { userId: user.id, audience, type: "SYSTEM_INFO", title: "Old pinned", body: "Synthetic", isPinned: true, createdAt: new Date("2026-01-01") } });
      const latest = await prisma.notification.create({ data: { userId: user.id, audience, type: audience === "BUSINESS" ? "BOOKING_CREATED" : "SYSTEM_INFO", title: "Latest", body: "Synthetic", actionMode: "PAGE", actionUrl: "/business/bookings?bookingId=" + booking.id, createdAt: new Date("2026-02-01") } });
      const feed = () => getUserInbox(user.id, { unreadOnly: true, options });
      assert.deepEqual((await feed()).map((row) => row.id), [latest.id, older.id]);
      assert.equal(await getUnreadCount(user.id, undefined, options), 2);
      await assert.rejects(resolveNotificationActionById(foreign.id, latest.id), /not found/);
      await assert.rejects(archiveNotification(foreign.id, latest.id), /not found/);
      await resolveNotificationActionById(user.id, latest.id);
      assert.deepEqual((await feed()).map((row) => row.id), [older.id]);
      assert.equal(await getUnreadCount(user.id, undefined, options), 1);
      assert.ok((await getUserInbox(user.id, { options })).some((row) => row.id === latest.id));
      await archiveNotification(user.id, latest.id);
      assert.equal(await countUserArchived(user.id, { options }), 1);
      assert.deepEqual((await getUserArchived(user.id, { options })).map((row) => row.id), [latest.id]);
      assert.equal(await prisma.notification.count({ where: { userId: user.id, audience } }), 2);
      assert.equal((await prisma.bookingRequest.findUniqueOrThrow({ where: { id: booking.id } })).status, "NEW");
    }
  } finally {
    await prisma.bookingRequest.deleteMany({ where: { businessId: business.id } });
    await prisma.business.delete({ where: { id: business.id } });
    await prisma.user.deleteMany({ where: { id: { in: [user.id, foreign.id] } } });
    await prisma.$disconnect();
  }
});
