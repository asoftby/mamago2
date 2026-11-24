/**
 * Read-only DEV/PROD diagnostic for one standard booking's BUSINESS notice.
 * Usage (in an authorized runtime with DATABASE_URL):
 *   pnpm exec tsx scripts/diagnostics/booking-business-notification-readonly.ts <bookingId>
 *
 * Prints no customer/child PII, chats, tokens or raw user identifiers.
 * Never changes database rows and never sends Telegram messages.
 */
import prisma from "../../src/lib/prisma";
import { getBusinessTelegramConfig } from "../../src/server/config/businessTelegram.config";
import { businessTelegramDeliveryEnabled } from "../../src/server/services/telegram/businessTelegramDelivery.service";

async function main() {
  const bookingId = process.argv[2]?.trim();
  if (!bookingId) throw new Error("Provide bookingId as the sole positional argument");

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: {
      businessId: true,
      userId: true,
      publicationType: true,
      kind: true,
      status: true,
      createdAt: true,
      business: { select: { ownerUserId: true, operationalStatus: true } },
    },
  });
  if (!booking) {
    console.log(JSON.stringify({ found: false, notificationCount: 0 }));
    return;
  }

  const notices = await prisma.notification.findMany({
    where: { entityType: "BOOKING", entityId: bookingId, type: "BOOKING_CREATED", audience: "BUSINESS" },
    select: { id: true, userId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const deliveryRows = notices.length ? await prisma.notificationDelivery.findMany({
    where: { notificationId: { in: notices.map((notice) => notice.id) } },
    select: { notificationId: true, channel: true, status: true, errorMessage: true },
  }) : [];
  const config = getBusinessTelegramConfig();
  const recipients = await prisma.businessMember.findMany({
    where: { businessId: booking.businessId, isActive: true, role: { in: ["OWNER", "MANAGER"] } },
    select: { userId: true },
  });
  const authorized = new Set(recipients.map((member) => member.userId));
  if (booking.business.ownerUserId) authorized.add(booking.business.ownerUserId);
  const connections = authorized.size ? await prisma.businessTelegramConnection.findMany({
    where: { userId: { in: [...authorized] }, environment: config.environment },
    select: { userId: true, businessId: true, isActive: true, botUsername: true },
  }) : [];
  const statusByNotice = new Map(notices.map((notice) => [notice.id, {
    isOwner: notice.userId === booking.business.ownerUserId,
    isActiveAuthorizedStaff: authorized.has(notice.userId),
    delivery: deliveryRows.filter((row) => row.notificationId === notice.id)
      .map((row) => ({ channel: row.channel, status: row.status, reason: row.errorMessage })),
  }]));

  console.log(JSON.stringify({
    found: true,
    source: booking.userId == null ? "GUEST" : "AUTHENTICATED",
    publicationType: booking.publicationType,
    kind: booking.kind,
    status: booking.status,
    createdAt: booking.createdAt.toISOString(),
    businessOperationalStatus: booking.business.operationalStatus,
    businessBot: { configured: config.configured, enabled: businessTelegramDeliveryEnabled() },
    authorizedStaffCount: authorized.size,
    eligibleBusinessBotConnections: connections.filter((conn) =>
      conn.isActive && conn.businessId === booking.businessId && conn.botUsername === config.botUsername
    ).length,
    notificationCount: notices.length,
    notifications: [...statusByNotice.values()],
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("BOOKING_NOTIFICATION_DIAGNOSTIC_FAILED", error instanceof Error ? error.name : "UNKNOWN");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
