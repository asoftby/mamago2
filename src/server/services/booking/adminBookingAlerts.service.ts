import "server-only";

import prisma from "@/lib/prisma";

/**
 * Admin booking alerts are IN_APP only: unlike business BOOKING_CREATED
 * messages, they must never go through the business Telegram/email policy.
 * The booking itself remains the source of truth and is never changed here.
 */
type AdminBookingAlert = {
  bookingId: string;
  businessName: string;
  publicationTitle: string | null;
};

const ALERT_TYPE = "BOOKING_CREATED" as const;
const ALERT_AUDIENCE = "ADMIN" as const;
const ALERT_ENTITY_TYPE = "BOOKING" as const;

async function ensureAdminBookingAlert(adminUserId: string, input: AdminBookingAlert): Promise<boolean> {
  const actionUrl = `/admin/orders/${encodeURIComponent(input.bookingId)}`;
  // The same booking may be discovered by the create path and by admin
  // reconciliation simultaneously. Serialize exact user+booking pairs.
  return prisma.$transaction(async (tx) => {
    const lockKey = `admin-booking-alert:${adminUserId}:${input.bookingId}`;
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const existing = await tx.notification.findFirst({
      where: {
        userId: adminUserId,
        audience: ALERT_AUDIENCE,
        type: ALERT_TYPE,
        entityType: ALERT_ENTITY_TYPE,
        entityId: input.bookingId,
      },
      select: { id: true },
    });
    if (existing) return false;
    await tx.notification.create({
      data: {
        userId: adminUserId,
        audience: ALERT_AUDIENCE,
        type: ALERT_TYPE,
        entityType: ALERT_ENTITY_TYPE,
        entityId: input.bookingId,
        title: `Новая заявка · ${input.businessName}`,
        body: `«${input.publicationTitle || "Публикация"}» — ожидает решения бизнеса.`,
        ctaLabel: "Открыть заявку",
        ctaAction: actionUrl,
        actionMode: "PAGE",
        actionUrl,
      },
    });
    return true;
  });
}

/** New public booking → one private, in-app admin bell notice per ADMIN. */
export async function notifyAdminsBookingCreated(input: {
  bookingId: string;
  businessId: string;
  publicationTitle: string | null;
}): Promise<void> {
  const [business, admins] = await Promise.all([
    prisma.business.findUnique({
      where: { id: input.businessId },
      select: { name: true },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    }),
  ]);
  if (!business || admins.length === 0) return;
  const alert: AdminBookingAlert = {
    bookingId: input.bookingId,
    businessName: business.name,
    publicationTitle: input.publicationTitle,
  };
  await Promise.all(admins.map(({ id }) => ensureAdminBookingAlert(id, alert)));
}

/**
 * Bounded repair for pending bookings created before this feature was deployed
 * or while the alert write failed. Called only by ADMIN notification reads.
 * Reconciliation never reopens an alert the admin already clicked.
 */
export async function reconcileRecentAdminBookingAlerts(adminUserId: string): Promise<number> {
  const createdSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const bookings = await prisma.bookingRequest.findMany({
    where: {
      kind: "STANDARD",
      status: "NEW",
      createdAt: { gte: createdSince },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      business: { select: { name: true } },
      activity: { select: { title: true } },
      offer: { select: { title: true } },
      place: { select: { title: true } },
    },
  });
  if (bookings.length === 0) return 0;

  const existing = await prisma.notification.findMany({
    where: {
      userId: adminUserId,
      audience: ALERT_AUDIENCE,
      type: ALERT_TYPE,
      entityType: ALERT_ENTITY_TYPE,
      entityId: { in: bookings.map(({ id }) => id) },
    },
    select: { entityId: true },
  });
  const seen = new Set(existing.map(({ entityId }) => entityId));
  let created = 0;
  for (const booking of bookings) {
    if (seen.has(booking.id)) continue;
    if (await ensureAdminBookingAlert(adminUserId, {
      bookingId: booking.id,
      businessName: booking.business.name,
      publicationTitle: booking.activity?.title ?? booking.offer?.title ?? booking.place?.title ?? null,
    })) created++;
  }
  return created;
}
