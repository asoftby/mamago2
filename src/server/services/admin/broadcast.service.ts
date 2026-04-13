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
  NotificationType,
  Role,
  type AdminBroadcast,
} from "@prisma/client";
import { createNotification } from "@/server/services/notification.service";

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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Маппинг BroadcastType → NotificationType */
function broadcastTypeToNotificationType(type: BroadcastType): NotificationType {
  switch (type) {
    case "NEWS":
      return "NEWS";
    case "ANNOUNCEMENT":
      return "ANNOUNCEMENT";
    case "SYSTEM":
      return "SYSTEM";
  }
}

/** Получить userId всех пользователей целевой аудитории */
async function resolveAudienceUserIds(audienceType: AudienceType): Promise<string[]> {
  if (audienceType === "BUSINESS") {
    const users = await prisma.user.findMany({
      where: { role: Role.BUSINESS_OWNER },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  if (audienceType === "USER") {
    const users = await prisma.user.findMany({
      where: { role: Role.USER },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  // ALL
  const users = await prisma.user.findMany({
    select: { id: true },
  });
  return users.map((u) => u.id);
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
      scheduledAt: input.scheduledAt ?? null,
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
    data: { status: "ARCHIVED" },
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
  const broadcast = await prisma.adminBroadcast.findUnique({ where: { id } });
  if (!broadcast) throw new Error("Broadcast not found");

  if (broadcast.status === "PUBLISHED") {
    throw new Error("Сообщение уже опубликовано");
  }
  if (broadcast.status === "ARCHIVED") {
    throw new Error("Нельзя опубликовать архивное сообщение");
  }
  if (!broadcast.showInInbox) {
    // Публикуем статус, но не создаём уведомления
    const updated = await prisma.adminBroadcast.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    return { broadcast: updated, notificationsCreated: 0 };
  }

  // Обновляем статус
  const published = await prisma.adminBroadcast.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  // Резолвим аудиторию
  const userIds = await resolveAudienceUserIds(broadcast.audienceType);
  if (userIds.length === 0) {
    return { broadcast: published, notificationsCreated: 0 };
  }

  const notificationType = broadcastTypeToNotificationType(broadcast.type);
  const bodySnapshot = broadcast.summary?.trim()
    ? broadcast.summary
    : broadcast.body.slice(0, 500);

  // Fan-out: создаём Notification для каждого пользователя
  // Используем createMany для производительности, без delivery dispatch
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: notificationType,
      title: broadcast.title,
      body: bodySnapshot,
      ctaLabel: broadcast.ctaLabel ?? null,
      ctaAction: broadcast.ctaUrl ?? null,
      isPinned: broadcast.pinToDashboard,
      entityType: "BROADCAST",
      entityId: broadcast.id,
    })),
    skipDuplicates: true,
  });

  return { broadcast: published, notificationsCreated: userIds.length };
}
