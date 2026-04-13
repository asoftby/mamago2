 
import prisma from "@/lib/prisma";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { UserStatus, UserModerationActionType, Role } from "@prisma/client";
import { logAudit } from "./auditLog.service";

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

  // Get activity stats
  const [businessCount, placesCount, activitiesCount] = await Promise.all([
    prisma.business.count({ where: { ownerUserId: userId } }),
    prisma.place.count({ 
      where: { 
        OR: [
          { createdByUserId: userId },
          { ownerBusiness: { ownerUserId: userId } }
        ]
      } 
    }),
    prisma.activity.count({ where: { ownerUserId: userId } }),
  ]);

  return {
    user,
    stats: {
      businessCount,
      placesCount,
      activitiesCount,
    },
  };
}

// Search users with filters
export async function searchUsers(query: string, filters: UserFilters = {}) {
  const { role, status, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const where: any = {};

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

  const [user, action] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.ACTIVE,
        statusReason: null,
        suspendedUntil: null,
      },
    }),
    prisma.userModerationAction.create({
      data: {
        userId,
        actionType: UserModerationActionType.UNBAN,
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

  // LIMITED status: document but allow for now
  return {
    isAllowed: true,
    status: user.status,
  };
}
