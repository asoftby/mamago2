/**
 * Admin Broadcast Service
 *
 * Управление AdminBroadcast: CRUD + publish use-case.
 * При публикации fan-out'ит Notification для целевой аудитории.
 *
 * Server-only — не импортировать в client components.
 */

import prisma from "@/lib/prisma";
import {
  BroadcastStatus,
  BroadcastType,
  AudienceType,
  BusinessMemberRole,
  Prisma,
  NotificationAudience,
  NotificationType,
  Role,
  type AdminBroadcast,
} from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CreateBroadcastInput = {
  title: string;
  summary?: string | null;
  body: string;
  type: BroadcastType;
  priority?: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  audienceType?: AudienceType;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  showInInbox?: boolean;
  sendEmail?: boolean;
  pinToDashboard?: boolean;
  scheduledAt?: Date | null;
};

export type UpdateBroadcastInput = Partial<CreateBroadcastInput>;

export type ListBroadcastsFilters = {
  status?: BroadcastStatus;
  type?: BroadcastType;
  audienceType?: AudienceType;
  limit?: number;
  offset?: number;
};

export type PublishedBroadcastEditInput = {
  title: string;
  summary?: string | null;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  pinToDashboard?: boolean;
  reason?: string | null;
};

type PublishAdminBroadcastOptions = {
  allowAlreadyPublished?: boolean;
  now?: Date;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Маппинг BroadcastType → unified NotificationType */
function broadcastTypeToNotificationType(
  type: BroadcastType,
  audienceType: AudienceType,
): NotificationType {
  if (audienceType === "BUSINESS") {
    return "BUSINESS_NEWS";
  }

  switch (type) {
    case "NEWS":
      return "FEATURE_UPDATE";
    case "ANNOUNCEMENT":
      return "SYSTEM_INFO";
    case "SYSTEM":
      return "SYSTEM_INFO";
  }
}

function buildBroadcastNotificationBody(broadcast: {
  summary?: string | null;
  body: string;
}): string {
  return broadcast.summary?.trim()
    ? broadcast.summary
    : broadcast.body.slice(0, 500);
}

function buildBroadcastRevisionSnapshot(broadcast: {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  type: BroadcastType;
  priority: string;
  audienceType: AudienceType;
  status: BroadcastStatus;
  ctaLabel: string | null;
  ctaUrl: string | null;
  showInInbox: boolean;
  sendEmail: boolean;
  pinToDashboard: boolean;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  lastEditedAfterPublishAt: Date | null;
  publishedEditCount: number;
}): Prisma.InputJsonObject {
  return {
    id: broadcast.id,
    title: broadcast.title,
    summary: broadcast.summary,
    body: broadcast.body,
    type: broadcast.type,
    priority: broadcast.priority,
    audienceType: broadcast.audienceType,
    status: broadcast.status,
    ctaLabel: broadcast.ctaLabel,
    ctaUrl: broadcast.ctaUrl,
    showInInbox: broadcast.showInInbox,
    sendEmail: broadcast.sendEmail,
    pinToDashboard: broadcast.pinToDashboard,
    publishedAt: broadcast.publishedAt?.toISOString() ?? null,
    scheduledAt: broadcast.scheduledAt?.toISOString() ?? null,
    lastEditedAfterPublishAt: broadcast.lastEditedAfterPublishAt?.toISOString() ?? null,
    publishedEditCount: broadcast.publishedEditCount,
  };
}

type BroadcastRecipient = {
  userId: string;
  audience: NotificationAudience;
};

function dedupeRecipients(
  recipients: BroadcastRecipient[],
): BroadcastRecipient[] {
  const byUserId = new Map<string, BroadcastRecipient>();
  for (const recipient of recipients) {
    const existing = byUserId.get(recipient.userId);
    if (!existing) {
      byUserId.set(recipient.userId, recipient);
      continue;
    }

    if (existing.audience !== "BUSINESS" && recipient.audience === "BUSINESS") {
      byUserId.set(recipient.userId, recipient);
    }
  }

  return [...byUserId.values()];
}

/** Получить получателей целевой аудитории вместе с audience для Notification */
async function resolveAudienceRecipients(
  audienceType: AudienceType,
): Promise<BroadcastRecipient[]> {
  if (audienceType === "BUSINESS") {
    const [members, businesses, legacyOwners] = await Promise.all([
      prisma.businessMember.findMany({
        where: {
          isActive: true,
          role: { in: [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER] },
        },
        select: { userId: true },
      }),
      prisma.business.findMany({
        select: { ownerUserId: true },
      }),
      prisma.user.findMany({
        where: { role: Role.BUSINESS_OWNER },
        select: { id: true },
      }),
    ]);

    return dedupeRecipients([
      ...members.map((item) => ({
        userId: item.userId,
        audience: NotificationAudience.BUSINESS,
      })),
      ...businesses.map((item) => ({
        userId: item.ownerUserId,
        audience: NotificationAudience.BUSINESS,
      })),
      ...legacyOwners.map((item) => ({
        userId: item.id,
        audience: NotificationAudience.BUSINESS,
      })),
    ]);
  }

  if (audienceType === "USER") {
    const users = await prisma.user.findMany({
      where: { role: Role.USER },
      select: { id: true },
    });
    return users.map((u) => ({
      userId: u.id,
      audience: NotificationAudience.USER,
    }));
  }

  // ALL
  const [users, businessRecipients] = await Promise.all([
    prisma.user.findMany({
      select: { id: true },
    }),
    resolveAudienceRecipients(AudienceType.BUSINESS),
  ]);

  const businessUserIds = new Set(businessRecipients.map((item) => item.userId));

  return dedupeRecipients([
    ...users.map((user) => ({
      userId: user.id,
      audience: businessUserIds.has(user.id)
        ? NotificationAudience.BUSINESS
        : NotificationAudience.USER,
    })),
  ]);
}

async function fanOutBroadcastNotifications(
  broadcast: AdminBroadcast,
): Promise<number> {
  if (!broadcast.showInInbox) return 0;

  const recipients = await resolveAudienceRecipients(broadcast.audienceType);
  if (recipients.length === 0) return 0;

  const existing = await prisma.notification.findMany({
    where: {
      entityType: "BROADCAST",
      entityId: broadcast.id,
      userId: { in: recipients.map((recipient) => recipient.userId) },
    },
    select: { userId: true },
  });
  const existingUserIds = new Set(existing.map((item) => item.userId));
  const missingRecipients = recipients.filter(
    (recipient) => !existingUserIds.has(recipient.userId),
  );

  if (missingRecipients.length === 0) return 0;

  const result = await prisma.notification.createMany({
    data: missingRecipients.map((recipient) => ({
      userId: recipient.userId,
      audience: recipient.audience,
      type: broadcastTypeToNotificationType(broadcast.type, broadcast.audienceType),
      title: broadcast.title,
      body: buildBroadcastNotificationBody(broadcast),
      ctaLabel: broadcast.ctaLabel ?? null,
      ctaAction: broadcast.ctaUrl ?? null,
      actionMode: broadcast.ctaUrl ? "PAGE" : "MODAL",
      actionUrl: broadcast.ctaUrl ?? null,
      modalTitle: broadcast.title,
      modalBody: broadcast.body,
      metadata: {
        broadcastId: broadcast.id,
        priority: broadcast.priority,
        audienceType: broadcast.audienceType,
      },
      isPinned: broadcast.pinToDashboard,
      entityType: "BROADCAST",
      entityId: broadcast.id,
    })),
  });

  return result.count;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function listAdminBroadcasts(filters: ListBroadcastsFilters = {}) {
  const { status, type, audienceType, limit = 50, offset = 0 } = filters;

  const where = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(audienceType ? { audienceType } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.adminBroadcast.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      skip: offset,
      include: { createdBy: { select: { id: true, email: true } } },
    }),
    prisma.adminBroadcast.count({ where }),
  ]);

  return { items, total };
}

export async function getAdminBroadcastById(id: string) {
  return prisma.adminBroadcast.findUnique({
    where: { id },
    include: { createdBy: { select: { id: true, email: true } } },
  });
}

export async function createAdminBroadcast(
  input: CreateBroadcastInput,
  actorId: string,
): Promise<AdminBroadcast> {
  return prisma.adminBroadcast.create({
    data: {
      title: input.title,
      summary: input.summary ?? null,
      body: input.body,
      type: input.type,
      priority: input.priority ?? "NORMAL",
      audienceType: input.audienceType ?? "BUSINESS",
      status: "DRAFT",
      ctaLabel: input.ctaLabel ?? null,
      ctaUrl: input.ctaUrl ?? null,
      showInInbox: input.showInInbox ?? true,
      sendEmail: input.sendEmail ?? false,
      pinToDashboard: input.pinToDashboard ?? false,
      scheduledAt: null,
      createdById: actorId,
    },
  });
}

export async function updateAdminBroadcast(
  id: string,
  input: UpdateBroadcastInput,
): Promise<AdminBroadcast> {
  const broadcast = await prisma.adminBroadcast.findUnique({ where: { id } });
  if (!broadcast) throw new Error("Broadcast not found");
  if (broadcast.status === "PUBLISHED") {
    throw new Error("Нельзя редактировать опубликованное сообщение");
  }

  return prisma.adminBroadcast.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.audienceType !== undefined ? { audienceType: input.audienceType } : {}),
      ...(input.ctaLabel !== undefined ? { ctaLabel: input.ctaLabel } : {}),
      ...(input.ctaUrl !== undefined ? { ctaUrl: input.ctaUrl } : {}),
      ...(input.showInInbox !== undefined ? { showInInbox: input.showInInbox } : {}),
      ...(input.sendEmail !== undefined ? { sendEmail: input.sendEmail } : {}),
      ...(input.pinToDashboard !== undefined ? { pinToDashboard: input.pinToDashboard } : {}),
      ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {}),
    },
  });
}

export async function archiveAdminBroadcast(id: string): Promise<AdminBroadcast> {
  const broadcast = await prisma.adminBroadcast.findUnique({ where: { id } });
  if (!broadcast) throw new Error("Broadcast not found");

  return prisma.adminBroadcast.update({
    where: { id },
    data: {
      status: "ARCHIVED",
      scheduledAt: null,
    },
  });
}

export async function scheduleAdminBroadcast(
  id: string,
  scheduledAt: Date,
): Promise<AdminBroadcast> {
  const broadcast = await prisma.adminBroadcast.findUnique({ where: { id } });
  if (!broadcast) throw new Error("Broadcast not found");
  if (broadcast.status === "PUBLISHED") {
    throw new Error("Опубликованное сообщение нельзя запланировать");
  }
  if (broadcast.status === "ARCHIVED") {
    throw new Error("Архивное сообщение нельзя запланировать");
  }
  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("Дата публикации должна быть в будущем");
  }

  return prisma.adminBroadcast.update({
    where: { id },
    data: {
      status: "SCHEDULED",
      scheduledAt,
    },
  });
}

export async function unscheduleAdminBroadcast(id: string): Promise<AdminBroadcast> {
  const broadcast = await prisma.adminBroadcast.findUnique({ where: { id } });
  if (!broadcast) throw new Error("Broadcast not found");
  if (broadcast.status !== "SCHEDULED") {
    throw new Error("В черновик можно вернуть только запланированное сообщение");
  }

  return prisma.adminBroadcast.update({
    where: { id },
    data: {
      status: "DRAFT",
      scheduledAt: null,
    },
  });
}

export async function createBroadcastCorrectionDraft(
  id: string,
  actorId: string,
): Promise<AdminBroadcast> {
  const broadcast = await prisma.adminBroadcast.findUnique({ where: { id } });
  if (!broadcast) throw new Error("Broadcast not found");

  return prisma.adminBroadcast.create({
    data: {
      title: `Исправление: ${broadcast.title}`,
      summary: broadcast.summary,
      body: `Исправляем информацию из предыдущего сообщения: «${broadcast.title}».\n\n[Напишите корректную информацию здесь]`,
      type: broadcast.type,
      priority: broadcast.priority,
      audienceType: broadcast.audienceType,
      status: "DRAFT",
      ctaLabel: broadcast.ctaLabel,
      ctaUrl: broadcast.ctaUrl,
      showInInbox: broadcast.showInInbox,
      sendEmail: broadcast.sendEmail,
      pinToDashboard: broadcast.pinToDashboard,
      scheduledAt: null,
      createdById: actorId,
    },
  });
}

export async function editPublishedAdminBroadcast(
  id: string,
  input: PublishedBroadcastEditInput,
  actorId: string,
): Promise<{ broadcast: AdminBroadcast; notificationsUpdated: number }> {
  const existing = await prisma.adminBroadcast.findUnique({ where: { id } });
  if (!existing) throw new Error("Broadcast not found");
  if (existing.status !== "PUBLISHED") {
    throw new Error("Исправление доступно только для опубликованного сообщения");
  }

  const updatedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const before = buildBroadcastRevisionSnapshot(existing);

    const updated = await tx.adminBroadcast.update({
      where: { id },
      data: {
        title: input.title,
        summary: input.summary ?? null,
        body: input.body,
        ctaLabel: input.ctaLabel ?? null,
        ctaUrl: input.ctaUrl ?? null,
        pinToDashboard: input.pinToDashboard ?? false,
        lastEditedAfterPublishAt: updatedAt,
        publishedEditCount: { increment: 1 },
      },
    });

    const after = buildBroadcastRevisionSnapshot(updated);

    await tx.adminBroadcastRevision.create({
      data: {
        broadcastId: updated.id,
        editedById: actorId,
        reason: input.reason ?? null,
        oldSnapshot: before,
        newSnapshot: after,
      },
    });

    const notificationsResult = await tx.notification.updateMany({
      where: {
        entityType: "BROADCAST",
        entityId: updated.id,
      },
      data: {
        title: updated.title,
        body: buildBroadcastNotificationBody(updated),
        ctaLabel: updated.ctaLabel ?? null,
        ctaAction: updated.ctaUrl ?? null,
        isPinned: updated.pinToDashboard,
      },
    });

    return {
      broadcast: updated,
      notificationsUpdated: notificationsResult.count,
    };
  });
}

// ── Publish use-case ──────────────────────────────────────────────────────────

/**
 * Публикует broadcast и создаёт Notification для целевой аудитории.
 *
 * Идемпотентность: если broadcast уже PUBLISHED — выбрасывает доменную ошибку.
 * Повторный publish невозможен.
 */
export async function publishAdminBroadcast(id: string): Promise<{
  broadcast: AdminBroadcast;
  notificationsCreated: number;
}> {
  return publishAdminBroadcastInternal(id);
}

async function publishAdminBroadcastInternal(
  id: string,
  options: PublishAdminBroadcastOptions = {},
): Promise<{
  broadcast: AdminBroadcast;
  notificationsCreated: number;
}> {
  const broadcast = await prisma.adminBroadcast.findUnique({ where: { id } });
  if (!broadcast) throw new Error("Broadcast not found");

  if (broadcast.status === "PUBLISHED") {
    if (options.allowAlreadyPublished) {
      return { broadcast, notificationsCreated: 0 };
    }
    throw new Error("Сообщение уже опубликовано");
  }
  if (broadcast.status === "ARCHIVED") {
    if (options.allowAlreadyPublished) {
      return { broadcast, notificationsCreated: 0 };
    }
    throw new Error("Нельзя опубликовать архивное сообщение");
  }
  if (broadcast.status === "DRAFT" && options.allowAlreadyPublished) {
    return { broadcast, notificationsCreated: 0 };
  }

  const publishedAt = options.now ?? new Date();
  const published = await prisma.adminBroadcast.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt,
      scheduledAt: null,
    },
  });

  const notificationsCreated = await fanOutBroadcastNotifications(published);
  return { broadcast: published, notificationsCreated };
}

export async function publishDueAdminBroadcasts(now = new Date()) {
  const dueItems = await prisma.adminBroadcast.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const items: Array<{ id: string; title: string; notificationsCreated: number }> = [];

  for (const item of dueItems) {
    const result = await publishAdminBroadcastInternal(item.id, {
      allowAlreadyPublished: true,
      now,
    });
    if (result.broadcast.status === "PUBLISHED") {
      items.push({
        id: result.broadcast.id,
        title: result.broadcast.title,
        notificationsCreated: result.notificationsCreated,
      });
    }
  }

  return {
    published: items.length,
    items,
  };
}
