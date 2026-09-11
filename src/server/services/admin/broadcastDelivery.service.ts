import "server-only";

import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email/emailAdapter";
import {
  AudienceType,
  BusinessMemberRole,
  Role,
  type AdminBroadcast,
} from "@prisma/client";
import {
  publishAdminBroadcast,
  publishDueAdminBroadcasts,
} from "./broadcast.service";

type BroadcastEmailRecipient = {
  id: string;
  email: string | null;
  marketingEmailsEnabled: boolean;
};

export type BroadcastEmailDeliverySummary = {
  requested: number;
  sent: number;
  skipped: number;
  failed: number;
  error?: string;
};

const EMAIL_BATCH_SIZE = 10;

function emptySummary(): BroadcastEmailDeliverySummary {
  return { requested: 0, sent: 0, skipped: 0, failed: 0 };
}

function isMarketingBroadcast(broadcast: AdminBroadcast): boolean {
  return broadcast.type !== "SYSTEM";
}

function buildBroadcastEmailText(broadcast: AdminBroadcast): string {
  const cta = broadcast.ctaUrl
    ? `\n\n${broadcast.ctaLabel?.trim() || "Подробнее"}: ${broadcast.ctaUrl}`
    : "";

  return `${broadcast.body}${cta}\n\n— mamaGo`;
}

async function resolveBroadcastEmailRecipients(
  audienceType: AudienceType,
): Promise<BroadcastEmailRecipient[]> {
  if (audienceType === AudienceType.BUSINESS) {
    const [members, businesses, legacyOwners] = await Promise.all([
      prisma.businessMember.findMany({
        where: {
          isActive: true,
          role: { in: [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER] },
        },
        select: { userId: true },
      }),
      prisma.business.findMany({ select: { ownerUserId: true } }),
      prisma.user.findMany({
        where: { role: Role.BUSINESS_OWNER },
        select: { id: true },
      }),
    ]);

    const userIds = [
      ...new Set([
        ...members.map((item) => item.userId),
        ...businesses.map((item) => item.ownerUserId),
        ...legacyOwners.map((item) => item.id),
      ]),
    ];

    if (userIds.length === 0) return [];

    return prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        marketingEmailsEnabled: true,
      },
    });
  }

  if (audienceType === AudienceType.USER) {
    return prisma.user.findMany({
      where: { role: Role.USER },
      select: {
        id: true,
        email: true,
        marketingEmailsEnabled: true,
      },
    });
  }

  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      marketingEmailsEnabled: true,
    },
  });
}

async function resolveBroadcastNotificationIds(
  broadcastId: string,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  const notifications = await prisma.notification.findMany({
    where: {
      entityType: "BROADCAST",
      entityId: broadcastId,
      userId: { in: userIds },
    },
    select: { id: true, userId: true },
  });

  return new Map(notifications.map((item) => [item.userId, item.id]));
}

async function findExistingEmailDelivery(params: {
  notificationId: string | null;
  dedupeKey: string;
}) {
  if (params.notificationId) {
    return prisma.notificationDelivery.findUnique({
      where: {
        notificationId_channel: {
          notificationId: params.notificationId,
          channel: "EMAIL",
        },
      },
      select: { id: true },
    });
  }

  return prisma.notificationDelivery.findFirst({
    where: {
      channel: "EMAIL",
      dedupeKey: params.dedupeKey,
    },
    select: { id: true },
  });
}

async function createEmailDeliveryRecord(params: {
  broadcast: AdminBroadcast;
  recipient: BroadcastEmailRecipient;
  notificationId: string | null;
  dedupeKey: string;
  status: "PENDING" | "SKIPPED";
  errorMessage?: string | null;
}) {
  return prisma.notificationDelivery.create({
    data: {
      userId: params.recipient.id,
      notificationId: params.notificationId,
      channel: "EMAIL",
      status: params.status,
      dedupeKey: params.dedupeKey,
      errorMessage: params.errorMessage ?? null,
      payloadJson: {
        source: "ADMIN_BROADCAST",
        broadcastId: params.broadcast.id,
        broadcastType: params.broadcast.type,
        audienceType: params.broadcast.audienceType,
        title: params.broadcast.title,
        ctaUrl: params.broadcast.ctaUrl,
      },
    },
    select: { id: true },
  });
}

async function deliverBroadcastEmailToRecipient(params: {
  broadcast: AdminBroadcast;
  recipient: BroadcastEmailRecipient;
  notificationId: string | null;
}): Promise<"sent" | "skipped" | "failed"> {
  const dedupeKey = `admin-broadcast:${params.broadcast.id}:${params.recipient.id}:EMAIL`;
  const existing = await findExistingEmailDelivery({
    notificationId: params.notificationId,
    dedupeKey,
  });
  if (existing) return "skipped";

  if (!params.recipient.email) {
    await createEmailDeliveryRecord({
      ...params,
      dedupeKey,
      status: "SKIPPED",
      errorMessage: "NO_EMAIL",
    });
    return "skipped";
  }

  if (
    isMarketingBroadcast(params.broadcast) &&
    !params.recipient.marketingEmailsEnabled
  ) {
    await createEmailDeliveryRecord({
      ...params,
      dedupeKey,
      status: "SKIPPED",
      errorMessage: "MARKETING_EMAIL_OPT_OUT",
    });
    return "skipped";
  }

  const delivery = await createEmailDeliveryRecord({
    ...params,
    dedupeKey,
    status: "PENDING",
  });

  const result = await sendEmail({
    to: params.recipient.email,
    subject: params.broadcast.title,
    text: buildBroadcastEmailText(params.broadcast),
  });

  if (result.ok) {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        errorMessage: null,
      },
    });
    return "sent";
  }

  const skippableErrors = new Set([
    "EMAIL_DISABLED",
    "EMAIL_NOT_CONFIGURED",
    "EMAIL_PROVIDER_NOT_IMPLEMENTED",
  ]);
  const status = skippableErrors.has(result.error ?? "") ? "SKIPPED" : "FAILED";

  await prisma.notificationDelivery.update({
    where: { id: delivery.id },
    data: {
      status,
      errorMessage: result.error ?? "EMAIL_SEND_FAILED",
    },
  });

  return status === "SKIPPED" ? "skipped" : "failed";
}

export async function deliverAdminBroadcastEmail(
  broadcast: AdminBroadcast,
): Promise<BroadcastEmailDeliverySummary> {
  if (!broadcast.sendEmail) return emptySummary();

  try {
    const recipients = await resolveBroadcastEmailRecipients(broadcast.audienceType);
    const summary: BroadcastEmailDeliverySummary = {
      requested: recipients.length,
      sent: 0,
      skipped: 0,
      failed: 0,
    };

    if (recipients.length === 0) return summary;

    const notificationIds = await resolveBroadcastNotificationIds(
      broadcast.id,
      recipients.map((recipient) => recipient.id),
    );

    for (let offset = 0; offset < recipients.length; offset += EMAIL_BATCH_SIZE) {
      const batch = recipients.slice(offset, offset + EMAIL_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((recipient) =>
          deliverBroadcastEmailToRecipient({
            broadcast,
            recipient,
            notificationId: notificationIds.get(recipient.id) ?? null,
          }),
        ),
      );

      for (const result of results) {
        if (result.status === "rejected") {
          summary.failed += 1;
          console.error("[broadcast:email] delivery failed", result.reason);
          continue;
        }
        summary[result.value] += 1;
      }
    }

    return summary;
  } catch (error) {
    console.error("[broadcast:email] fan-out failed", error);
    return {
      ...emptySummary(),
      error: error instanceof Error ? error.message : "Unknown broadcast email error",
    };
  }
}

export async function publishAdminBroadcastWithDelivery(id: string) {
  const result = await publishAdminBroadcast(id);
  const emailDelivery = await deliverAdminBroadcastEmail(result.broadcast);
  return { ...result, emailDelivery };
}

export async function publishDueAdminBroadcastsWithDelivery(now = new Date()) {
  const result = await publishDueAdminBroadcasts(now);
  const items = [];

  for (const item of result.items) {
    const broadcast = await prisma.adminBroadcast.findUnique({
      where: { id: item.id },
    });
    const emailDelivery = broadcast
      ? await deliverAdminBroadcastEmail(broadcast)
      : { ...emptySummary(), error: "Broadcast not found after publish" };

    items.push({ ...item, emailDelivery });
  }

  return {
    published: result.published,
    items,
  };
}
