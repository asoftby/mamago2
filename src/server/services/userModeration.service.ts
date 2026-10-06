import prisma from "@/lib/prisma";
import {
  ActivityType,
  BusinessMemberRole,
  UserStatus,
  UserModerationActionType,
  Role,
  Prisma,
} from "@prisma/client";
import { logAudit } from "./auditLog.service";
import { isSessionEligibleStatus } from "@/lib/auth/accountEligibility";

// Types
export interface UserFilters {
  role?: Role;
  status?: UserStatus;
  page?: number;
  limit?: number;
}

export interface WarnUserParams {
  userId: string;
  reason: string;
  note?: string;
  moderatorId: string;
}

export interface LimitUserParams {
  userId: string;
  reason: string;
  note?: string;
  moderatorId: string;
}

export interface SuspendUserParams {
  userId: string;
  reason: string;
  note?: string;
  expiresAt: Date;
  moderatorId: string;
}

export interface BanUserParams {
  userId: string;
  reason: string;
  note?: string;
  moderatorId: string;
}

export interface UnbanUserParams {
  userId: string;
  reason: string;
  note?: string;
  moderatorId: string;
}

export interface ChangeRoleParams {
  userId: string;
  newRole: Role;
  reason: string;
  note?: string;
  moderatorId: string;
}

export interface UserStatusCheck {
  isAllowed: boolean;
  status: UserStatus;
  reason?: string;
  suspendedUntil?: Date | null;
}

// Get user with full details
export async function getUserWithDetails(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phoneE164: true,
      displayName: true,
      telegramConnected: true,
      telegramUsername: true,
      role: true,
      status: true,
      statusReason: true,
      suspendedUntil: true,
      lastLoginAt: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const businessSelect = {
    id: true,
    name: true,
    legalName: true,
    verificationStatus: true,
    operationalStatus: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.BusinessSelect;

  const [memberships, ownedBusiness] = await Promise.all([
    prisma.businessMember.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        isActive: true,
        title: true,
        createdAt: true,
        business: { select: businessSelect },
      },
    }),
    prisma.business.findUnique({
      where: { ownerUserId: userId },
      select: businessSelect,
    }),
  ]);

  const businessRelations = memberships.map((membership) => ({
    ...membership.business,
    membershipRole: membership.role,
    membershipActive: membership.isActive,
    memberTitle: membership.title,
    relation:
      ownedBusiness?.id === membership.business.id
        ? ("OWNER" as const)
        : ("MEMBER" as const),
  }));

  if (
    ownedBusiness &&
    !businessRelations.some((business) => business.id === ownedBusiness.id)
  ) {
    businessRelations.unshift({
      ...ownedBusiness,
      membershipRole: BusinessMemberRole.OWNER,
      membershipActive: false,
      memberTitle: null,
      relation: "OWNER_WITHOUT_MEMBERSHIP" as const,
    });
  }

  const businessIds = Array.from(
    new Set(businessRelations.map((business) => business.id)),
  );

  const placesWhere: Prisma.PlaceWhereInput = {
    OR: [
      { createdByUserId: userId },
      ...(businessIds.length > 0
        ? [{ ownerBusinessId: { in: businessIds } } satisfies Prisma.PlaceWhereInput]
        : []),
    ],
  };

  const offersWhere: Prisma.OfferWhereInput =
    businessIds.length > 0
      ? { place: { ownerBusinessId: { in: businessIds } } }
      : { id: "__no_business__" };

  const [
    placeCount,
    places,
    eventCount,
    events,
    offerCount,
    offers,
    articleCount,
    articles,
    activePlanCount,
    bookingCount,
    directThreadCount,
    complaintCount,
    recentBookings,
    recentThreads,
    verificationLogs,
  ] = await Promise.all([
    prisma.place.count({ where: placesWhere }),
    prisma.place.findMany({
      where: placesWhere,
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        createdByUserId: true,
        ownerBusinessId: true,
        city: { select: { name: true } },
        ownerBusiness: {
          select: { id: true, name: true, legalName: true },
        },
      },
    }),
    prisma.activity.count({
      where: {
        ownerUserId: userId,
        type: ActivityType.EVENT,
        status: { not: "DELETED" },
      },
    }),
    prisma.activity.findMany({
      where: {
        ownerUserId: userId,
        type: ActivityType.EVENT,
        status: { not: "DELETED" },
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        place: { select: { title: true } },
        business: { select: { id: true, name: true, legalName: true } },
      },
    }),
    prisma.offer.count({ where: offersWhere }),
    prisma.offer.findMany({
      where: offersWhere,
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        place: {
          select: {
            id: true,
            title: true,
            ownerBusiness: {
              select: { id: true, name: true, legalName: true },
            },
          },
        },
      },
    }),
    prisma.article.count({ where: { authorUserId: userId } }),
    prisma.article.findMany({
      where: { authorUserId: userId },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.planItem.count({
      where: { userId, cancelledAt: null },
    }),
    prisma.bookingRequest.count({ where: { userId } }),
    prisma.directThread.count({ where: { customerUserId: userId } }),
    prisma.directComplaint.count({ where: { reporterUserId: userId } }),
    prisma.bookingRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        createdAt: true,
        activity: { select: { id: true, title: true } },
        offer: { select: { id: true, title: true } },
        place: { select: { id: true, title: true } },
      },
    }),
    prisma.directThread.findMany({
      where: { customerUserId: userId },
      orderBy: { lastMessageAt: "desc" },
      take: 5,
      select: {
        id: true,
        threadNumber: true,
        status: true,
        lastMessageAt: true,
        business: { select: { name: true, legalName: true } },
      },
    }),
    businessIds.length > 0
      ? prisma.businessVerificationLog.findMany({
          where: { businessId: { in: businessIds } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            businessId: true,
            statusFrom: true,
            statusTo: true,
            createdAt: true,
            business: { select: { name: true, legalName: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const recentActions = [
    ...(user.lastLoginAt
      ? [
          {
            id: `login-${user.id}`,
            kind: "LOGIN" as const,
            title: "Вход в аккаунт",
            detail: user.email,
            href: null,
            at: user.lastLoginAt,
          },
        ]
      : []),
    ...events.slice(0, 5).map((event) => ({
      id: `event-${event.id}`,
      kind: "EVENT" as const,
      title: event.title,
      detail: "Событие · последнее изменение",
      href: `/editor/event/${event.id}/edit?returnTo=${encodeURIComponent(
        `/admin/users/${userId}`,
      )}`,
      at: event.updatedAt,
    })),
    ...articles.slice(0, 5).map((article) => ({
      id: `article-${article.id}`,
      kind: "ARTICLE" as const,
      title: article.title,
      detail: "Статья · последнее изменение",
      href: `/admin/content/articles/${article.id}/edit`,
      at: article.updatedAt,
    })),
    ...recentBookings.map((booking) => ({
      id: `booking-${booking.id}`,
      kind: "BOOKING" as const,
      title:
        booking.activity?.title ??
        booking.offer?.title ??
        booking.place?.title ??
        "Заявка",
      detail: `Заявка · ${booking.status}`,
      href: null,
      at: booking.createdAt,
    })),
    ...recentThreads.map((thread) => ({
      id: `direct-${thread.id}`,
      kind: "DIRECT" as const,
      title: `Диалог D-${thread.threadNumber}`,
      detail: thread.business.legalName || thread.business.name,
      href: null,
      at: thread.lastMessageAt,
    })),
    ...verificationLogs.map((log) => ({
      id: `verification-${log.id}`,
      kind: "BUSINESS" as const,
      title: log.business.legalName || log.business.name,
      detail: `Верификация бизнеса: ${log.statusFrom} → ${log.statusTo}`,
      href: `/admin/b2b/partners/${log.businessId}`,
      at: log.createdAt,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12);

  const activeBusinessMembership = businessRelations.find(
    (business) =>
      business.membershipActive &&
      (business.membershipRole === BusinessMemberRole.OWNER ||
        business.membershipRole === BusinessMemberRole.MANAGER),
  );
  const accessBusiness =
    activeBusinessMembership ?? businessRelations[0] ?? null;

  return {
    user,
    stats: {
      businessCount: businessRelations.length,
      placesCount: placeCount,
      activitiesCount: eventCount,
    },
    businessAccess: {
      membershipRole: accessBusiness?.membershipRole ?? null,
      membershipActive: accessBusiness?.membershipActive ?? false,
      relation:
        accessBusiness?.relation === "OWNER_WITHOUT_MEMBERSHIP"
          ? "OWNER_WITHOUT_MEMBERSHIP"
          : accessBusiness
            ? "MEMBER"
            : "NONE",
      business: accessBusiness
        ? {
            id: accessBusiness.id,
            name: accessBusiness.name,
            legalName: accessBusiness.legalName,
            verificationStatus: accessBusiness.verificationStatus,
            operationalStatus: accessBusiness.operationalStatus,
          }
        : null,
    },
    overview: {
      businesses: businessRelations,
      places: {
        total: placeCount,
        items: places,
      },
      publications: {
        events: { total: eventCount, items: events },
        offers: { total: offerCount, items: offers },
        articles: { total: articleCount, items: articles },
      },
      customerActivity: {
        planItems: activePlanCount,
        bookings: bookingCount,
        directThreads: directThreadCount,
        complaints: complaintCount,
      },
      recentActions,
    },
  };
}

// Search users with filters
export async function searchUsers(query: string, filters: UserFilters = {}) {
  const { role, status, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {};

  // Search query
  if (query) {
    where.OR = [
      { email: { contains: query, mode: "insensitive" } },
      { phoneE164: { contains: query } },
    ];
  }

  // Filters
  if (role) {
    where.role = role;
  }
  if (status) {
    where.status = status;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        phoneE164: true,
        telegramId: true,
        telegramUsername: true,
        role: true,
        status: true,
        lastLoginAt: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// Warn user (no status change)
export async function warnUser(params: WarnUserParams) {
  const { userId, reason, note, moderatorId } = params;

  const action = await prisma.userModerationAction.create({
    data: {
      userId,
      actionType: UserModerationActionType.WARN,
      reason,
      note,
      createdById: moderatorId,
    },
  });

  await logAudit({
    actorId: moderatorId,
    targetType: "USER",
    targetId: userId,
    action: "USER_WARNED",
    metadata: { reason, note },
  });

  return action;
}

// Limit user
export async function limitUser(params: LimitUserParams) {
  const { userId, reason, note, moderatorId } = params;

  const [user, action] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.LIMITED,
        statusReason: reason,
      },
    }),
    prisma.userModerationAction.create({
      data: {
        userId,
        actionType: UserModerationActionType.LIMIT,
        reason,
        note,
        createdById: moderatorId,
      },
    }),
  ]);

  await logAudit({
    actorId: moderatorId,
    targetType: "USER",
    targetId: userId,
    action: "USER_LIMITED",
    metadata: { reason, note },
  });

  return { user, action };
}

// Suspend user temporarily
export async function suspendUser(params: SuspendUserParams) {
  const { userId, reason, note, expiresAt, moderatorId } = params;

  const [user, action] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.SUSPENDED,
        statusReason: reason,
        suspendedUntil: expiresAt,
      },
    }),
    prisma.userModerationAction.create({
      data: {
        userId,
        actionType: UserModerationActionType.SUSPEND,
        reason,
        note,
        expiresAt,
        createdById: moderatorId,
      },
    }),
  ]);

  await logAudit({
    actorId: moderatorId,
    targetType: "USER",
    targetId: userId,
    action: "USER_SUSPENDED",
    metadata: { reason, note, expiresAt: expiresAt.toISOString() },
  });

  return { user, action };
}

// Ban user permanently
export async function banUser(params: BanUserParams) {
  const { userId, reason, note, moderatorId } = params;

  const [user, action] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.BANNED,
        statusReason: reason,
        suspendedUntil: null,
      },
    }),
    prisma.userModerationAction.create({
      data: {
        userId,
        actionType: UserModerationActionType.BAN,
        reason,
        note,
        createdById: moderatorId,
      },
    }),
  ]);

  await logAudit({
    actorId: moderatorId,
    targetType: "USER",
    targetId: userId,
    action: "USER_BANNED",
    metadata: { reason, note },
  });

  return { user, action };
}

// Unban user
export async function unbanUser(params: UnbanUserParams) {
  const { userId, reason, note, moderatorId } = params;

  const { user, action } = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (
      !current ||
      (current.status !== UserStatus.BANNED && current.status !== UserStatus.SUSPENDED)
    ) {
      throw new Error("USER_NOT_BLOCKED");
    }

    const user = await tx.user.update({
      where: { id: userId },
      data: { status: UserStatus.ACTIVE, statusReason: null, suspendedUntil: null },
    });
    const action = await tx.userModerationAction.create({
      data: {
        userId,
        actionType: UserModerationActionType.UNBAN,
        reason,
        note,
        createdById: moderatorId,
      },
    });
    return { user, action };
  });

  await logAudit({
    actorId: moderatorId,
    targetType: "USER",
    targetId: userId,
    action: "USER_UNBANNED",
    metadata: { reason, note },
  });

  return { user, action };
}

// Change user role
export async function changeUserRole(params: ChangeRoleParams) {
  const { userId, newRole, reason, note, moderatorId } = params;

  const oldUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!oldUser) {
    throw new Error("User not found");
  }

  const [user, action] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    }),
    prisma.userModerationAction.create({
      data: {
        userId,
        actionType: UserModerationActionType.ROLE_CHANGE,
        reason,
        note,
        createdById: moderatorId,
        metadata: {
          oldRole: oldUser.role,
          newRole,
        },
      },
    }),
  ]);

  await logAudit({
    actorId: moderatorId,
    targetType: "USER",
    targetId: userId,
    action: "USER_ROLE_CHANGED",
    metadata: { oldRole: oldUser.role, newRole, reason, note },
  });

  return { user, action };
}

// Get user moderation history
export async function getUserModerationHistory(userId: string) {
  const actions = await prisma.userModerationAction.findMany({
    where: { userId },
    include: {
      createdBy: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return actions;
}

// Check user status (for auth enforcement)
export async function checkUserStatus(userId: string): Promise<UserStatusCheck> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      statusReason: true,
      suspendedUntil: true,
    },
  });

  if (!user) {
    return {
      isAllowed: false,
      status: UserStatus.BANNED,
      reason: "User not found",
    };
  }

  // Check if banned
  if (user.status === UserStatus.BANNED) {
    return {
      isAllowed: false,
      status: user.status,
      reason: user.statusReason || "Account banned",
    };
  }

  // Check if suspended
  if (user.status === UserStatus.SUSPENDED) {
    if (user.suspendedUntil && user.suspendedUntil > new Date()) {
      return {
        isAllowed: false,
        status: user.status,
        reason: user.statusReason || "Account suspended",
        suspendedUntil: user.suspendedUntil,
      };
    } else {
      // Suspension expired, auto-unban
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.ACTIVE,
          statusReason: null,
          suspendedUntil: null,
        },
      });
      return {
        isAllowed: true,
        status: UserStatus.ACTIVE,
      };
    }
  }

  if (!isSessionEligibleStatus(user.status)) {
    return {
      isAllowed: false,
      status: user.status,
      reason: user.statusReason || "Account is not active",
    };
  }

  // LIMITED is deliberately session-eligible; feature-level restrictions are
  // enforced by moderation policy rather than by removing authentication.
  return {
    isAllowed: true,
    status: user.status,
  };
}
