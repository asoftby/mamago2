/**
 * Notification Service
 *
 * Single entry point for all in-app notifications + delivery dispatch.
 * Server-only — do not import in client components.
 *
 * Flow:
 *   createNotification(params) → saves Notification → dispatchDelivery(notification, user)
 *
 * All notify*() helpers are thin wrappers that resolve the owner userId
 * and call createNotification(). Route handlers should call these helpers,
 * not createNotification() directly.
 */

import prisma from "@/lib/prisma";
import {
  canArchiveNotification,
  enrichNotificationsWithLifecycle,
  getUserActionResolutionState,
  NotificationArchiveBlockedError,
} from "@/server/notifications/notification-lifecycle";
import { getTelegramLinkStatus } from "@/server/services/telegramLink.service";
import {
  Prisma,
  type Notification as NotificationModel,
  type NotificationActionMode,
  type NotificationEntityType,
  NotificationType,
} from "@prisma/client";
import {
  NOTIFICATION_TYPES_BUSINESS,
  NOTIFICATION_TYPES_USER,
} from "@/lib/notifications/streamFilters";
import {
  WELCOME_NOTIFICATION_BODY,
  WELCOME_NOTIFICATION_TITLE,
} from "@/lib/notifications/welcomeNotification";
import { resolveNotificationAudience } from "@/lib/notifications/audience";
import { dispatchDelivery } from "./notificationDelivery.service";
import { validateNotificationRegistry } from "@/lib/notifications/notificationRegistry";
import { checkNotificationDedup } from "./notificationDedup.service";
import {
  resolveNotificationAction,
  resolveNotificationActionDefaults,
  resolveNotificationPageUrl,
} from "@/server/notifications/notification-action-resolver";

// ─── Dev Validation ───────────────────────────────────────────────────────────

// Run registry validation in development
if (process.env.NODE_ENV === "development") {
  // Get all NotificationType enum values from Prisma
  const prismaTypes = Object.values(NotificationType);
  validateNotificationRegistry(prismaTypes);
}

// ─── Dev Validation ───────────────────────────────────────────────────────────

// Run registry validation in development
if (process.env.NODE_ENV === "development") {
  // Get all NotificationType enum values from Prisma
  const prismaTypes = Object.values(NotificationType);
  validateNotificationRegistry(prismaTypes);
}

export type NotificationStreamFilter = "user" | "business";

/**
 * Determine which notification surfaces (audiences) are accessible to a user.
 * This is the canonical source for "what notifications should this user see".
 */
export function getAccessibleSurfacesForUser(user: {
  id: string;
  role: string;
  business?: { id: string } | null;
}): Array<"USER" | "BUSINESS" | "ADMIN"> {
  const surfaces: Array<"USER" | "BUSINESS" | "ADMIN"> = ["USER"];
  
  if (user.business) {
    surfaces.push("BUSINESS");
  } else if (user.role === "BUSINESS_OWNER") {
    surfaces.push("BUSINESS");
  }

  if (user.role === "ADMIN") {
    surfaces.push("ADMIN");
  }
  
  return surfaces;
}

function mergeStreamFilter(
  base: Prisma.NotificationWhereInput,
  stream?: NotificationStreamFilter,
): Prisma.NotificationWhereInput {
  if (stream === "user") return { ...base, type: { in: NOTIFICATION_TYPES_USER } };
  if (stream === "business") return { ...base, type: { in: NOTIFICATION_TYPES_BUSINESS } };
  return base;
}

/**
 * Hide WELCOME notification from the feed when Telegram is already connected.
 * The DB record is preserved — only the feed query excludes it.
 * WELCOME is a legacy onboarding type; it is not part of the active USER settings model.
 */
function mergeHideWelcomeWhenTelegramConnected(
  base: Prisma.NotificationWhereInput,
  telegramConnected?: boolean,
): Prisma.NotificationWhereInput {
  if (telegramConnected !== true) return base;
  return {
    AND: [base, { NOT: { type: "WELCOME" } }],
  };
}

/**
 * Filter notifications by accessible surfaces (audiences).
 * This replaces stream-based filtering with audience-based filtering.
 */
function mergeAccessibleSurfacesFilter(
  base: Prisma.NotificationWhereInput,
  accessibleSurfaces: Array<"USER" | "BUSINESS" | "ADMIN">,
): Prisma.NotificationWhereInput {
  if (accessibleSurfaces.length === 0) {
    return { ...base, audience: { in: [] } };
  }
  return { ...base, audience: { in: accessibleSurfaces } };
}

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  audience?: "USER" | "BUSINESS" | "ADMIN";
  title: string;
  body: string;
  ctaLabel?: string | null;
  ctaAction?: string | null;
  isPinned?: boolean;
  entityType?: NotificationEntityType;
  entityId?: string;
  actionMode?: NotificationActionMode;
  actionUrl?: string | null;
  modalTitle?: string | null;
  modalBody?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  expiresAt?: Date | null;
}

type OnboardingNotificationKind = "VERIFY_EMAIL" | "VERIFY_PHONE" | "CONNECT_TELEGRAM";

const ONBOARDING_NOTIFICATION_CONFIG: Record<
  OnboardingNotificationKind,
  {
    entityId: string;
    title: string;
    body: string;
    ctaLabel: string;
    actionUrl: string;
    metadata: { kind: OnboardingNotificationKind };
  }
> = {
  VERIFY_EMAIL: {
    entityId: "VERIFY_EMAIL",
    title: "Подтвердите email",
    body: "Подтвердите почту, чтобы сохранить доступ к аккаунту и получать важные уведомления.",
    ctaLabel: "Подтвердить",
    actionUrl: "/me/settings/account",
    metadata: { kind: "VERIFY_EMAIL" },
  },
  VERIFY_PHONE: {
    entityId: "VERIFY_PHONE",
    title: "Подтвердите телефон",
    body: "Подтвердите номер телефона, чтобы использовать важные действия и защищённые функции mamaGo.",
    ctaLabel: "Подтвердить",
    actionUrl: "/settings/security",
    metadata: { kind: "VERIFY_PHONE" },
  },
  CONNECT_TELEGRAM: {
    entityId: "CONNECT_TELEGRAM",
    title: "Подключите Telegram",
    body: "Получайте уведомления о заявках, планах и событиях прямо в Telegram.",
    ctaLabel: "Подключить",
    actionUrl: "/me/settings/notifications",
    metadata: { kind: "CONNECT_TELEGRAM" },
  },
};

/**
 * Core: create in-app notification record + dispatch delivery channels.
 * Never throws on delivery failure — delivery errors are recorded in NotificationDelivery.
 */
export async function createNotification(params: CreateNotificationParams) {
  const resolvedAction = resolveNotificationActionDefaults({
    type: params.type,
    title: params.title,
    body: params.body,
    actionMode: params.actionMode ?? null,
    actionUrl: params.actionUrl ?? params.ctaAction ?? resolveNotificationPageUrl({
      type: params.type,
      entityType: params.entityType,
      entityId: params.entityId,
      actionUrl: params.actionUrl ?? params.ctaAction ?? null,
    }),
    modalTitle: params.modalTitle ?? null,
    modalBody: params.modalBody ?? null,
  });

  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      audience: params.audience ?? resolveNotificationAudience(params.type),
      type: params.type,
      title: params.title,
      body: params.body,
      ctaLabel: params.ctaLabel ?? null,
      ctaAction: params.ctaAction ?? resolvedAction.actionUrl,
      actionMode: resolvedAction.actionMode,
      actionUrl: resolvedAction.actionUrl,
      modalTitle: resolvedAction.modalTitle,
      modalBody: resolvedAction.modalBody,
      metadata: params.metadata ?? undefined,
      expiresAt: params.expiresAt ?? null,
      isPinned: params.isPinned ?? false,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
    },
  });

  // Dispatch delivery async — fire and forget, never blocks the caller
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true, role: true },
  });
  if (user) {
    dispatchDelivery(notification, user).catch((e) =>
      console.error("[notification] dispatchDelivery failed:", e),
    );
  }

  return notification;
}

/**
 * Send a one-time welcome notification after registration.
 * Uses the legacy WELCOME type — this is an onboarding record, not a settings category.
 * Deduplication: only one WELCOME per user is ever created.
 */
export async function notifyWelcomeNewUser(userId: string) {
  const existing = await prisma.notification.findFirst({
    where: { userId, type: "WELCOME" },
    select: { id: true },
  });
  if (existing) return null;

  return createNotification({
    userId,
    type: "WELCOME",
    title: WELCOME_NOTIFICATION_TITLE,
    body: WELCOME_NOTIFICATION_BODY,
    isPinned: true,
  });
}

/**
 * Send notification after successful email verification.
 * Uses SYSTEM type — account security event.
 */
export async function notifyEmailVerified(userId: string) {
  return createNotification({
    userId,
    type: "SYSTEM",
    audience: "USER",
    title: "Ваша почта подтверждена",
    body: "Теперь вы можете получать важные уведомления и восстанавливать доступ к аккаунту.",
    isPinned: false,
  });
}

async function ensureOnboardingNotification(
  userId: string,
  kind: OnboardingNotificationKind,
) {
  const config = ONBOARDING_NOTIFICATION_CONFIG[kind];
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      audience: "USER",
      type: "SYSTEM",
      entityType: null,
      entityId: config.entityId,
      archivedAt: null,
    },
    select: { id: true },
  });

  if (existing) return existing;

  return createNotification({
    userId,
    audience: "USER",
    type: "SYSTEM",
    title: config.title,
    body: config.body,
    ctaLabel: config.ctaLabel,
    ctaAction: config.actionUrl,
    actionMode: "PAGE",
    actionUrl: config.actionUrl,
    isPinned: true,
    entityId: config.entityId,
    metadata: config.metadata,
  });
}

export async function ensureUserOnboardingNotifications(userId: string) {
  const [user, telegramStatus] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
      },
    }),
    getTelegramLinkStatus({ userId }),
  ]);

  if (!user) return null;

  const results = await Promise.all([
    user.emailVerifiedAt == null
      ? ensureOnboardingNotification(user.id, "VERIFY_EMAIL")
      : completeOnboardingNotification(user.id, "VERIFY_EMAIL"),
    // телефон запрашивается контекстно, не в онбординге
    // ensureOnboardingNotification(user.id, "VERIFY_PHONE"),
    telegramStatus.linked
      ? completeOnboardingNotification(user.id, "CONNECT_TELEGRAM")
      : ensureOnboardingNotification(user.id, "CONNECT_TELEGRAM"),
  ]);

  return results;
}

export async function completeOnboardingNotification(
  userId: string,
  kind: OnboardingNotificationKind,
) {
  const config = ONBOARDING_NOTIFICATION_CONFIG[kind];
  const now = new Date();

  return prisma.notification.updateMany({
    where: {
      userId,
      audience: "USER",
      type: "SYSTEM",
      entityType: null,
      entityId: config.entityId,
      archivedAt: null,
    },
    data: {
      isRead: true,
      readAt: now,
      seenAt: now,
      archivedAt: now,
    },
  });
}

/** Синхронизирует action-required onboarding-уведомления с фактическим состоянием аккаунта. */
export async function reconcileResolvedActionRequiredNotifications(userId: string) {
  const state = await getUserActionResolutionState(userId);

  await Promise.all([
    state.emailVerified
      ? completeOnboardingNotification(userId, "VERIFY_EMAIL")
      : Promise.resolve(),
    state.telegramLinked
      ? completeOnboardingNotification(userId, "CONNECT_TELEGRAM")
      : Promise.resolve(),
    state.phoneVerified
      ? completeOnboardingNotification(userId, "VERIFY_PHONE")
      : Promise.resolve(),
  ]);

  return state;
}

// ── PLACE ─────────────────────────────────────────────────────────────────────

export async function notifyPlaceApproved(placeId: string, placeName: string, ownerId: string) {
  const dedup = await checkNotificationDedup(ownerId, "PLACE_APPROVED", "PLACE", placeId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "PLACE_APPROVED",
    title: "Место опубликовано",
    body: `Ваше место «${placeName}» успешно прошло модерацию и теперь доступно пользователям mamaGo.`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceNeedsChanges(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string,
) {
  const dedup = await checkNotificationDedup(ownerId, "PLACE_NEEDS_CHANGES", "PLACE", placeId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "PLACE_NEEDS_CHANGES",
    title: "Требуются правки",
    body: `Ваше место «${placeName}» требует доработки. ${moderatorComment}`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceRejected(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string,
) {
  const dedup = await checkNotificationDedup(ownerId, "PLACE_REJECTED", "PLACE", placeId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "PLACE_REJECTED",
    title: "Место отклонено",
    body: `Ваше место «${placeName}» было отклонено. ${moderatorComment}`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceUpdateApproved(placeId: string, placeName: string, ownerId: string) {
  const dedup = await checkNotificationDedup(ownerId, "PLACE_UPDATE_APPROVED", "PLACE", placeId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "PLACE_UPDATE_APPROVED",
    title: "Изменения опубликованы",
    body: `Изменения для места «${placeName}» успешно прошли модерацию и опубликованы.`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceUpdateNeedsRevision(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string,
) {
  const dedup = await checkNotificationDedup(ownerId, "PLACE_UPDATE_NEEDS_REVISION", "PLACE", placeId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "PLACE_UPDATE_NEEDS_REVISION",
    title: "Требуются правки",
    body: `Изменения для места «${placeName}» требуют правок. ${moderatorComment}`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceUpdateRejected(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string,
) {
  const dedup = await checkNotificationDedup(ownerId, "PLACE_UPDATE_REJECTED", "PLACE", placeId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "PLACE_UPDATE_REJECTED",
    title: "Изменения отклонены",
    body: `Изменения для места «${placeName}» были отклонены. ${moderatorComment}`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

// ── ACTIVITY ──────────────────────────────────────────────────────────────────

export async function notifyActivityApproved(activityId: string, activityName: string, ownerId: string) {
  const dedup = await checkNotificationDedup(ownerId, "ACTIVITY_APPROVED", "ACTIVITY", activityId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "ACTIVITY_APPROVED",
    title: "Событие опубликовано",
    body: `Ваше событие «${activityName}» успешно прошло модерацию и теперь доступно пользователям mamaGo.`,
    entityType: "ACTIVITY",
    entityId: activityId,
  });
}

export async function notifyActivityNeedsChanges(
  activityId: string,
  activityName: string,
  ownerId: string,
  moderatorComment: string,
) {
  const dedup = await checkNotificationDedup(ownerId, "ACTIVITY_NEEDS_CHANGES", "ACTIVITY", activityId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "ACTIVITY_NEEDS_CHANGES",
    title: "Требуются правки",
    body: `Ваше событие «${activityName}» требует доработки. ${moderatorComment}`,
    entityType: "ACTIVITY",
    entityId: activityId,
  });
}

export async function notifyActivityRejected(
  activityId: string,
  activityName: string,
  ownerId: string,
  moderatorComment: string,
) {
  const dedup = await checkNotificationDedup(ownerId, "ACTIVITY_REJECTED", "ACTIVITY", activityId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "ACTIVITY_REJECTED",
    title: "Событие отклонено",
    body: `Ваше событие «${activityName}» было отклонено. ${moderatorComment}`,
    entityType: "ACTIVITY",
    entityId: activityId,
  });
}

// ── OFFER ─────────────────────────────────────────────────────────────────────

export async function notifyOfferApproved(offerId: string, offerName: string, ownerId: string) {
  const dedup = await checkNotificationDedup(ownerId, "OFFER_APPROVED", "OFFER", offerId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "OFFER_APPROVED",
    title: "Предложение опубликовано",
    body: `Ваше предложение «${offerName}» успешно прошло модерацию и теперь доступно пользователям mamaGo.`,
    entityType: "OFFER",
    entityId: offerId,
  });
}

export async function notifyOfferNeedsChanges(
  offerId: string,
  offerName: string,
  ownerId: string,
  moderatorComment: string,
) {
  const dedup = await checkNotificationDedup(ownerId, "OFFER_NEEDS_CHANGES", "OFFER", offerId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "OFFER_NEEDS_CHANGES",
    title: "Требуются правки",
    body: `Ваше предложение «${offerName}» требует доработки. ${moderatorComment}`,
    entityType: "OFFER",
    entityId: offerId,
  });
}

export async function notifyOfferRejected(
  offerId: string,
  offerName: string,
  ownerId: string,
  moderatorComment: string,
) {
  const dedup = await checkNotificationDedup(ownerId, "OFFER_REJECTED", "OFFER", offerId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "OFFER_REJECTED",
    title: "Предложение отклонено",
    body: `Ваше предложение «${offerName}» было отклонено. ${moderatorComment}`,
    entityType: "OFFER",
    entityId: offerId,
  });
}

// ── BUSINESS VERIFICATION ─────────────────────────────────────────────────────

/**
 * Окно дедупа для событий «подача заявки на верификацию»: защищает только от
 * даблклика по submit. Повторная подача после NEEDS_INFO/REJECTED должна
 * порождать новые уведомления, поэтому checkNotificationDedup (бессрочный
 * по entityId) здесь сознательно не используется.
 */
const VERIFICATION_SUBMIT_DEDUP_WINDOW_MS = 5 * 60 * 1000;

async function hasRecentNotification(
  userId: string,
  type: NotificationType,
  entityId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - VERIFICATION_SUBMIT_DEDUP_WINDOW_MS);
  const existing = await prisma.notification.findFirst({
    where: { userId, type, entityId, createdAt: { gte: since } },
    select: { id: true },
  });
  return Boolean(existing);
}

/**
 * On-site/telegram уведомление всем админам о новой заявке на верификацию.
 */
export async function notifyAdminsBusinessApplicationCreated(params: {
  businessId: string;
  businessName: string;
  ownerEmail?: string | null;
}) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  const created = [];
  for (const admin of admins) {
    if (await hasRecentNotification(admin.id, "BUSINESS_APPLICATION_CREATED", params.businessId)) {
      continue;
    }
    created.push(
      await createNotification({
        userId: admin.id,
        audience: "ADMIN",
        type: "BUSINESS_APPLICATION_CREATED",
        title: "Новая заявка на верификацию бизнеса",
        body: `«${params.businessName}»${params.ownerEmail ? ` · ${params.ownerEmail}` : ""} — заявка ожидает проверки.`,
        entityType: "BUSINESS",
        entityId: params.businessId,
      }),
    );
  }
  return created;
}

/**
 * Уведомление владельцу: заявка принята и отправлена на модерацию.
 */
export async function notifyBusinessVerificationSubmitted(
  businessId: string,
  businessName: string,
  ownerId: string,
) {
  if (await hasRecentNotification(ownerId, "BUSINESS_VERIFICATION_SUBMITTED", businessId)) {
    return null;
  }

  return createNotification({
    userId: ownerId,
    type: "BUSINESS_VERIFICATION_SUBMITTED",
    title: "Заявка принята",
    body: `Профиль «${businessName}» отправлен на модерацию. Мы сообщим о результате проверки.`,
    entityType: "BUSINESS",
    entityId: businessId,
  });
}

export async function notifyBusinessVerified(businessId: string, businessName: string, ownerId: string) {
  const dedup = await checkNotificationDedup(ownerId, "BUSINESS_VERIFIED", "BUSINESS", businessId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "BUSINESS_VERIFIED",
    title: "Верификация пройдена",
    body: `Ваш бизнес «${businessName}» успешно верифицирован. Теперь вы можете публиковать места и события.`,
    entityType: "BUSINESS",
    entityId: businessId,
  });
}

export async function notifyBusinessRejected(
  businessId: string,
  businessName: string,
  ownerId: string,
  note: string,
) {
  const dedup = await checkNotificationDedup(ownerId, "BUSINESS_REJECTED", "BUSINESS", businessId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "BUSINESS_REJECTED",
    title: "Верификация отклонена",
    body: `Верификация бизнеса «${businessName}» отклонена. ${note}`,
    entityType: "BUSINESS",
    entityId: businessId,
  });
}

export async function notifyBusinessNeedsInfo(
  businessId: string,
  businessName: string,
  ownerId: string,
  note: string,
) {
  const dedup = await checkNotificationDedup(ownerId, "BUSINESS_NEEDS_INFO", "BUSINESS", businessId);
  if (dedup.isDuplicate) return null;

  return createNotification({
    userId: ownerId,
    type: "BUSINESS_NEEDS_INFO",
    title: "Требуется дополнительная информация",
    body: `Для верификации бизнеса «${businessName}» требуется дополнительная информация. ${note}`,
    entityType: "BUSINESS",
    entityId: businessId,
  });
}

// ── READ / QUERY ──────────────────────────────────────────────────────────────

export type UserNotificationsQueryOptions = {
  /** Если true — не отдаём WELCOME в списке (история в БД сохраняется). */
  telegramConnected?: boolean;
  /** Accessible surfaces (audiences) for the user */
  accessibleSurfaces?: Array<"USER" | "BUSINESS" | "ADMIN">;
};

const notificationListOrderBy = [
  { isPinned: "desc" as const },
  { createdAt: "desc" as const },
];

function buildNotificationBaseWhere(
  userId: string,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
): Prisma.NotificationWhereInput {
  let where: Prisma.NotificationWhereInput;

  if (options?.accessibleSurfaces && options.accessibleSurfaces.length > 0) {
    where = mergeAccessibleSurfacesFilter({ userId }, options.accessibleSurfaces);
  } else {
    where = mergeStreamFilter({ userId }, stream);
  }

  return mergeHideWelcomeWhenTelegramConnected(where, options?.telegramConnected);
}

/**
 * Единая лента: сначала непросмотренные (seenAt IS NULL), затем просмотренные;
 * внутри группы — закрепы выше, далее createdAt desc.
 * Фильтрует по accessible surfaces вместо stream.
 */
export async function getUnifiedNotificationFeed(
  userId: string,
  limit: number,
  offset: number,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
): Promise<NotificationModel[]> {
  const where = {
    ...buildNotificationBaseWhere(userId, stream, options),
    archivedAt: null,
  } satisfies Prisma.NotificationWhereInput;

  return prisma.notification.findMany({
    where,
    orderBy: [
      { readAt: { sort: "asc", nulls: "first" } },
      { isPinned: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
    skip: offset,
  });
}

export async function countUnifiedNotifications(
  userId: string,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
): Promise<number> {
  const where = {
    ...buildNotificationBaseWhere(userId, stream, options),
    archivedAt: null,
  } satisfies Prisma.NotificationWhereInput;

  return prisma.notification.count({ where });
}

/** Legacy helper: opening the panel may mark items as seen, but never as read. */
export async function markUnseenNotificationsAsSeen(
  userId: string,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
) {
  const now = new Date();

  const where = {
    ...buildNotificationBaseWhere(userId, stream, options),
    archivedAt: null,
    seenAt: null,
  } satisfies Prisma.NotificationWhereInput;

  return prisma.notification.updateMany({
    where,
    data: { seenAt: now },
  });
}

export async function getUnreadNotifications(
  userId: string,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
  take?: number,
) {
  const where = {
    ...buildNotificationBaseWhere(userId, stream, options),
    archivedAt: null,
    readAt: null,
  } satisfies Prisma.NotificationWhereInput;

  return prisma.notification.findMany({
    where,
    orderBy: notificationListOrderBy,
    ...(take != null ? { take } : {}),
  });
}

export async function getReadNotifications(
  userId: string,
  limit = 80,
  offset = 0,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
) {
  const where = {
    ...buildNotificationBaseWhere(userId, stream, options),
    archivedAt: null,
    readAt: { not: null },
  } satisfies Prisma.NotificationWhereInput;

  return prisma.notification.findMany({
    where,
    orderBy: notificationListOrderBy,
    take: limit,
    skip: offset,
  });
}

/** @deprecated Используйте getUnifiedNotificationFeed */
export async function getUserNotifications(
  userId: string,
  limit = 50,
  offset = 0,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
) {
  return getUnifiedNotificationFeed(userId, limit, offset, stream, options);
}

export async function markNotificationAsRead(notificationId: string, userId: string) {
  const now = new Date();
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true },
  });
  if (!existing) throw new Error("Notification not found");

  return prisma.notification.update({
    where: { id: existing.id },
    data: { isRead: true, readAt: now, seenAt: now },
  });
}

export async function markAllNotificationsAsRead(userId: string) {
  const now = new Date();
  return prisma.notification.updateMany({
    where: { userId, archivedAt: null, readAt: null },
    data: { isRead: true, readAt: now, seenAt: now },
  });
}

export async function getUnreadCount(
  userId: string,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
): Promise<number> {
  const where = {
    ...buildNotificationBaseWhere(userId, stream, options),
    archivedAt: null,
    readAt: null,
  } satisfies Prisma.NotificationWhereInput;

  return prisma.notification.count({ where });
}

export async function getUserInbox(
  userId: string,
  filters: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    stream?: NotificationStreamFilter;
    options?: UserNotificationsQueryOptions;
  } = {},
) {
  const where = {
    ...buildNotificationBaseWhere(userId, filters.stream, filters.options),
    archivedAt: null,
    ...(filters.unreadOnly ? { readAt: null } : {}),
  } satisfies Prisma.NotificationWhereInput;

  return prisma.notification.findMany({
    where,
    orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, ...notificationListOrderBy],
    take: filters.limit ?? 50,
    skip: filters.offset ?? 0,
  });
}

export async function getUserArchived(
  userId: string,
  filters: {
    limit?: number;
    offset?: number;
    stream?: NotificationStreamFilter;
    options?: UserNotificationsQueryOptions;
  } = {},
) {
  const where = {
    ...buildNotificationBaseWhere(userId, filters.stream, filters.options),
    archivedAt: { not: null },
  } satisfies Prisma.NotificationWhereInput;

  return prisma.notification.findMany({
    where,
    orderBy: [{ archivedAt: "desc" }, ...notificationListOrderBy],
    take: filters.limit ?? 50,
    skip: filters.offset ?? 0,
  });
}

export async function countUserArchived(
  userId: string,
  filters: {
    stream?: NotificationStreamFilter;
    options?: UserNotificationsQueryOptions;
  } = {},
) {
  const where = {
    ...buildNotificationBaseWhere(userId, filters.stream, filters.options),
    archivedAt: { not: null },
  } satisfies Prisma.NotificationWhereInput;

  return prisma.notification.count({ where });
}

export async function archiveNotification(userId: string, notificationId: string) {
  await reconcileResolvedActionRequiredNotifications(userId);

  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!existing) throw new Error("Notification not found");

  const state = await getUserActionResolutionState(userId);
  if (!canArchiveNotification(existing, state)) {
    throw new NotificationArchiveBlockedError();
  }

  return prisma.notification.update({
    where: { id: existing.id },
    data: { archivedAt: new Date() },
  });
}

export async function archiveAllRead(userId: string) {
  await reconcileResolvedActionRequiredNotifications(userId);

  const state = await getUserActionResolutionState(userId);
  const candidates = await prisma.notification.findMany({
    where: {
      userId,
      archivedAt: null,
      readAt: { not: null },
    },
    select: {
      id: true,
      type: true,
      entityId: true,
      metadata: true,
    },
  });

  const archivableIds = candidates
    .filter((notification) => canArchiveNotification(notification, state))
    .map((notification) => notification.id);

  if (archivableIds.length === 0) {
    return { count: 0 };
  }

  const result = await prisma.notification.updateMany({
    where: { id: { in: archivableIds } },
    data: { archivedAt: new Date() },
  });

  return { count: result.count };
}

export async function restoreNotification(userId: string, notificationId: string) {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true },
  });
  if (!existing) throw new Error("Notification not found");

  return prisma.notification.update({
    where: { id: existing.id },
    data: { archivedAt: null },
  });
}

export async function resolveNotificationActionById(
  userId: string,
  notificationId: string,
) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new Error("Notification not found");
  }

  const action = resolveNotificationAction(notification);

  if (notification.readAt == null) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        isRead: true,
        readAt: new Date(),
        seenAt: notification.seenAt ?? new Date(),
      },
    });
  }

  return {
    notificationId: notification.id,
    ...action,
  };
}

export async function getLatestActivePlanReminderNotification(
  userId: string,
  now = new Date(),
) {
  const activeSince = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  return prisma.notification.findFirst({
    where: {
      userId,
      scenario: "PLAN_EVENT_2H_BEFORE",
      audience: "USER",
      entityType: "PLAN_ITEM",
      createdAt: { gte: activeSince },
    },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      body: true,
      ctaLabel: true,
      ctaAction: true,
      createdAt: true,
      isRead: true,
      scenario: true,
      entityType: true,
      entityId: true,
    },
  });
}

/** После подключения Telegram — скрыть WELCOME из UI и снять непрочитанность. */
export async function markWelcomeNotificationsRead(userId: string) {
  const now = new Date();
  return prisma.notification.updateMany({
    where: {
      userId,
      type: "WELCOME",
      OR: [{ readAt: null }, { isRead: false }],
    },
    data: { isRead: true, readAt: now, seenAt: now },
  });
}

/** Проверить, просмотрено ли welcome (для Telegram banner). */
export async function getWelcomeIsRead(userId: string): Promise<boolean> {
  const welcome = await prisma.notification.findFirst({
    where: { userId, type: "WELCOME" },
    select: { readAt: true, isRead: true },
  });
  if (!welcome) return true;
  return welcome.readAt != null || welcome.isRead;
}

export async function deleteOldNotifications(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  return prisma.notification.deleteMany({
    where: { archivedAt: { not: null, lt: cutoffDate } },
  });
}

export async function notifyAdminModerationItemCreated(params: {
  userId: string;
  itemTitle: string;
  itemId?: string;
}) {
  return createNotification({
    userId: params.userId,
    audience: "ADMIN",
    type: "ADMIN_MODERATION_ITEM_CREATED",
    title: "Новый объект на модерации",
    body: params.itemTitle,
    entityType: "MODERATION_ITEM",
    entityId: params.itemId ?? undefined,
  });
}

export async function notifyUserPlanReminder(params: {
  userId: string;
  title: string;
  body: string;
  entityId?: string | null;
}) {
  return createNotification({
    userId: params.userId,
    audience: "USER",
    type: "REMINDER",
    title: params.title,
    body: params.body,
    entityType: "PLAN_ITEM",
    entityId: params.entityId ?? undefined,
  });
}

// ── BOOKING ───────────────────────────────────────────────────────────────────

import {
  buildBookingNotificationBody,
  type BookingNotificationBodyInput,
} from "./booking/booking.formatters";
import { resolveBookingSourceType } from "./booking/booking.types";

export interface NotifyBookingCreatedParams {
  /** userId владельца бизнеса (получатель уведомления) */
  ownerUserId: string;
  bookingId: string;
  offerId?: string | null;
  offerTitle?: string | null;
  activityId?: string | null;
  activityTitle?: string | null;
  placeId?: string | null;
  placeTitle?: string | null;
  campShiftId?: string | null;
  campShiftTitle?: string | null;
  campShiftDateFrom?: string | null;
  campShiftDateTo?: string | null;
  customerName: string;
  childName?: string | null;
  childAge?: number | null;
}

/**
 * Уведомление бизнесу о новой заявке на запись.
 * Тело строится через buildBookingNotificationBody — без лагерь-специфичных assumptions.
 */
export async function notifyBookingCreated(params: NotifyBookingCreatedParams) {
  const sourceType = resolveBookingSourceType({
    campShiftId: params.campShiftId ?? null,
    offerId: params.offerId ?? null,
    activityId: params.activityId ?? null,
    placeId: params.placeId ?? null,
  });

  const bodyInput: BookingNotificationBodyInput = {
    sourceType,
    offerTitle: params.offerTitle ?? null,
    activityTitle: params.activityTitle ?? null,
    placeTitle: params.placeTitle ?? null,
    campShiftTitle: params.campShiftTitle ?? null,
    campShiftDateFrom: params.campShiftDateFrom ?? null,
    campShiftDateTo: params.campShiftDateTo ?? null,
    customerName: params.customerName,
    childName: params.childName ?? null,
    childAge: params.childAge ?? null,
  };

  const body = buildBookingNotificationBody(bodyInput);

  return createNotification({
    userId: params.ownerUserId,
    audience: "BUSINESS",
    type: "BOOKING_CREATED",
    title: "Новая заявка",
    body,
    entityType: "BOOKING",
    entityId: params.bookingId,
    ctaLabel: "Открыть заявку",
    ctaAction: `/business/bookings?id=${params.bookingId}`,
  });
}

// ── USER BOOKING LIFECYCLE ────────────────────────────────────────────────────

export interface NotifyUserBookingParams {
  /** userId владельца заявки (получатель уведомления) */
  userId: string;
  bookingId: string;
  /** Название активности/предложения/места (для тела уведомления) */
  publicationTitle?: string | null;
}

/**
 * Уведомление пользователю: бизнес подтвердил заявку.
 * Вызывается при переходе NEW → CONFIRMED.
 * Dedup: one per status change (no time window)
 */
export async function notifyUserBookingConfirmed(params: NotifyUserBookingParams) {
  // Check dedup
  const dedup = await checkNotificationDedup(
    params.userId,
    "BOOKING_CONFIRMED",
    "BOOKING",
    params.bookingId,
  );
  if (dedup.isDuplicate) {
    console.warn("[notification] BOOKING_CONFIRMED deduplicated:", params.bookingId);
    return null;
  }

  const title = params.publicationTitle ? `«${params.publicationTitle}»` : "Ваша заявка";
  return createNotification({
    userId: params.userId,
    audience: "USER",
    type: "BOOKING_CONFIRMED",
    title: "Заявка подтверждена",
    body: `${title} подтверждена. Ждём вас!`,
    entityType: "BOOKING",
    entityId: params.bookingId,
    ctaLabel: "Мои записи",
    ctaAction: "/me/bookings",
  });
}

/**
 * Уведомление пользователю: бизнес отклонил заявку.
 * Вызывается при переходе NEW|CONFIRMED → REJECTED.
 * Dedup: one per status change (no time window)
 */
export async function notifyUserBookingCancelled(params: NotifyUserBookingParams) {
  // Check dedup
  const dedup = await checkNotificationDedup(
    params.userId,
    "BOOKING_CANCELLED",
    "BOOKING",
    params.bookingId,
  );
  if (dedup.isDuplicate) {
    console.warn("[notification] BOOKING_CANCELLED deduplicated:", params.bookingId);
    return null;
  }

  const title = params.publicationTitle ? `«${params.publicationTitle}»` : "Ваша заявка";
  return createNotification({
    userId: params.userId,
    audience: "USER",
    type: "BOOKING_CANCELLED",
    title: "Заявка отклонена",
    body: `${title} была отклонена. Вы можете подать новую заявку.`,
    entityType: "BOOKING",
    entityId: params.bookingId,
    ctaLabel: "Мои записи",
    ctaAction: "/me/bookings",
  });
}

/**
 * Уведомление пользователю: заявка завершена.
 * Вызывается при переходе CONFIRMED → COMPLETED.
 * Dedup: one per status change (no time window)
 */
export async function notifyUserBookingCompleted(params: NotifyUserBookingParams) {
  // Check dedup
  const dedup = await checkNotificationDedup(
    params.userId,
    "BOOKING_COMPLETED",
    "BOOKING",
    params.bookingId,
  );
  if (dedup.isDuplicate) {
    console.warn("[notification] BOOKING_COMPLETED deduplicated:", params.bookingId);
    return null;
  }

  const title = params.publicationTitle ? `«${params.publicationTitle}»` : "Ваша заявка";
  return createNotification({
    userId: params.userId,
    audience: "USER",
    type: "BOOKING_COMPLETED",
    title: "Заявка завершена",
    body: `${title} завершена. Спасибо, что выбрали нас!`,
    entityType: "BOOKING",
    entityId: params.bookingId,
    ctaLabel: "Мои записи",
    ctaAction: "/me/bookings",
  });
}

/**
 * Уведомление пользователю: запрос отзыва после завершения.
 * Вызывается после BOOKING_COMPLETED, если feedback flow доступен.
 * Dedup: one per booking completion (no time window)
 *
 * TODO: Когда появится страница /me/bookings/:id с формой отзыва,
 * обновить ctaAction на `/me/bookings/${params.bookingId}`.
 */
export async function notifyUserBookingFeedbackRequest(params: NotifyUserBookingParams) {
  // Check dedup
  const dedup = await checkNotificationDedup(
    params.userId,
    "BOOKING_FEEDBACK_REQUEST",
    "BOOKING",
    params.bookingId,
  );
  if (dedup.isDuplicate) {
    console.warn("[notification] BOOKING_FEEDBACK_REQUEST deduplicated:", params.bookingId);
    return null;
  }

  const title = params.publicationTitle ? `«${params.publicationTitle}»` : "посещение";
  return createNotification({
    userId: params.userId,
    audience: "USER",
    type: "BOOKING_FEEDBACK_REQUEST",
    title: "Как прошло?",
    body: `Поделитесь впечатлениями о ${title}. Ваш отзыв поможет другим родителям.`,
    entityType: "BOOKING",
    entityId: params.bookingId,
    ctaLabel: "Оставить отзыв",
    ctaAction: "/me/bookings",
  });
}
