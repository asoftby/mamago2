/**
 * MVP business team invites (MANAGER only; create/revoke by OWNER).
 */

import {
  BusinessInviteStatus,
  BusinessMemberRole,
  type User,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/auth/crypto";
import { emailService } from "@/features/email/server/email-service";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";

export const BUSINESS_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const BUSINESS_INVITE_PUBLIC_ACCEPT_PATH = "/invite/business";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function buildBusinessInviteAcceptPath(token: string): string {
  return `${BUSINESS_INVITE_PUBLIC_ACCEPT_PATH}?token=${encodeURIComponent(token)}`;
}

/** Canonical OWNER: billing owner or active BusinessMember OWNER (backfilled). */
export async function isBusinessOwnerForInvites(
  userId: string,
  businessId: string,
): Promise<boolean> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerUserId: true },
  });
  if (!business) return false;
  if (business.ownerUserId === userId) return true;

  const ownerMember = await prisma.businessMember.findFirst({
    where: {
      businessId,
      userId,
      isActive: true,
      role: BusinessMemberRole.OWNER,
    },
    select: { id: true },
  });
  return ownerMember !== null;
}

export async function canListBusinessInvites(
  userId: string,
  businessId: string,
): Promise<boolean> {
  if (await isBusinessOwnerForInvites(userId, businessId)) return true;

  const manager = await prisma.businessMember.findFirst({
    where: {
      businessId,
      userId,
      isActive: true,
      role: BusinessMemberRole.MANAGER,
    },
    select: { id: true },
  });
  return manager !== null;
}

export async function markExpiredInvites(
  inviteIds: string[],
): Promise<void> {
  if (inviteIds.length === 0) return;
  await prisma.businessInvite.updateMany({
    where: {
      id: { in: inviteIds },
      status: BusinessInviteStatus.PENDING,
      expiresAt: { lt: new Date() },
    },
    data: { status: BusinessInviteStatus.EXPIRED },
  });
}

export type CreateInviteInput = {
  businessId: string;
  email: string;
  position?: string | null;
  invitedByUserId: string;
};

export type CreateInviteResult =
  | {
      ok: true;
      invite: {
        id: string;
        token: string;
        expiresAt: Date;
        acceptPath: string;
        acceptUrl: string;
      };
    }
  | { ok: false; code: "NOT_OWNER" | "DUPLICATE_PENDING" | "ALREADY_MEMBER" | "INVALID_EMAIL" };

export async function createBusinessInvite(
  input: CreateInviteInput,
): Promise<CreateInviteResult> {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    return { ok: false, code: "INVALID_EMAIL" };
  }

  const ownerOk = await isBusinessOwnerForInvites(input.invitedByUserId, input.businessId);
  if (!ownerOk) {
    return { ok: false, code: "NOT_OWNER" };
  }

  await prisma.businessInvite.updateMany({
    where: {
      businessId: input.businessId,
      email,
      status: BusinessInviteStatus.PENDING,
      expiresAt: { lt: new Date() },
    },
    data: { status: BusinessInviteStatus.EXPIRED },
  });

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    const member = await prisma.businessMember.findFirst({
      where: {
        businessId: input.businessId,
        userId: existingUser.id,
        isActive: true,
      },
      select: { id: true },
    });
    if (member) {
      return { ok: false, code: "ALREADY_MEMBER" };
    }
  }

  const pending = await prisma.businessInvite.findFirst({
    where: {
      businessId: input.businessId,
      email,
      status: BusinessInviteStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (pending) {
    return { ok: false, code: "DUPLICATE_PENDING" };
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + BUSINESS_INVITE_TTL_MS);

  // Validate and normalize position
  let normalizedPosition: string | null = null;
  if (input.position) {
    const trimmed = input.position.trim();
    if (trimmed.length > 0) {
      if (trimmed.length > 80) {
        normalizedPosition = trimmed.substring(0, 80);
      } else {
        normalizedPosition = trimmed;
      }
    }
  }

  const invite = await prisma.businessInvite.create({
    data: {
      businessId: input.businessId,
      email,
      role: BusinessMemberRole.MANAGER,
      token,
      status: BusinessInviteStatus.PENDING,
      expiresAt,
      invitedById: input.invitedByUserId,
      title: normalizedPosition,
    },
  });

  const base = getPublicBaseUrl();
  const acceptPath = buildBusinessInviteAcceptPath(token);
  const acceptUrl = `${base}${acceptPath}`;

  // Get business and inviter info for email
  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { name: true },
  });

  const inviter = await prisma.user.findUnique({
    where: { id: input.invitedByUserId },
    select: { displayName: true },
  });

  // Send email using the new email service
  try {
    await emailService.sendBusinessInvite({
      to: email,
      businessName: business?.name || "бизнеса",
      inviterName: inviter?.displayName,
      acceptUrl,
      expiresInDays: 7,
    });
  } catch (error) {
    console.error("[businessInvite] Failed to send invite email:", error);
    // Don't fail the invite creation if email fails
  }

  return {
    ok: true,
    invite: {
      id: invite.id,
      token,
      expiresAt,
      acceptPath,
      acceptUrl,
    },
  };
}

function getPublicBaseUrl(): string {
  const env = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (env) {
    return env.startsWith("http") ? env.replace(/\/$/, "") : `https://${env.replace(/\/$/, "")}`;
  }
  return getCanonicalPublicAppUrl();
}

export type AcceptInviteResult =
  | { ok: true; alreadyMember?: boolean; businessId: string; email: string }
  | {
      ok: false;
      code:
        | "INVITE_NOT_FOUND"
        | "EMAIL_MISMATCH"
        | "NOT_PENDING"
        | "EXPIRED"
        | "REVOKED";
    };

export type BusinessInviteAcceptanceState =
  | {
      ok: true;
      invite: {
        id: string;
        businessId: string;
        businessName: string | null;
        email: string;
        token: string;
        invitedByEmail: string | null;
      };
    }
  | {
      ok: false;
      code: "INVITE_NOT_FOUND" | "NOT_PENDING" | "EXPIRED" | "REVOKED";
    };

export async function getBusinessInviteAcceptanceState(
  token: string,
): Promise<BusinessInviteAcceptanceState> {
  const invite = await prisma.businessInvite.findUnique({
    where: { token },
    include: {
      business: {
        select: { name: true },
      },
      invitedBy: {
        select: { email: true },
      },
    },
  });

  if (!invite) {
    return { ok: false, code: "INVITE_NOT_FOUND" };
  }

  if (invite.status === BusinessInviteStatus.REVOKED) {
    return { ok: false, code: "REVOKED" };
  }

  const now = new Date();
  if (invite.expiresAt < now) {
    if (invite.status === BusinessInviteStatus.PENDING) {
      await prisma.businessInvite.update({
        where: { id: invite.id },
        data: { status: BusinessInviteStatus.EXPIRED },
      });
    }
    return { ok: false, code: "EXPIRED" };
  }

  if (invite.status !== BusinessInviteStatus.PENDING) {
    return { ok: false, code: "NOT_PENDING" };
  }

  return {
    ok: true,
    invite: {
      id: invite.id,
      businessId: invite.businessId,
      businessName: invite.business.name,
      email: invite.email,
      token: invite.token,
      invitedByEmail: invite.invitedBy?.email ?? null,
    },
  };
}

export async function hasUserForBusinessInviteEmail(email: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      email: { equals: normalizeEmail(email), mode: "insensitive" },
      deletedAt: null,
    },
    select: { id: true },
  });

  return user !== null;
}

export async function acceptBusinessInvite(
  user: Pick<User, "id" | "email" | "emailVerifiedAt">,
  token: string,
): Promise<AcceptInviteResult> {
  const invite = await prisma.businessInvite.findUnique({
    where: { token },
  });

  if (!invite) {
    return { ok: false, code: "INVITE_NOT_FOUND" };
  }

  if (invite.status === BusinessInviteStatus.REVOKED) {
    return { ok: false, code: "REVOKED" };
  }

  const now = new Date();

  const existing = await prisma.businessMember.findUnique({
    where: {
      businessId_userId: {
        businessId: invite.businessId,
        userId: user.id,
      },
    },
  });

  if (invite.status === BusinessInviteStatus.ACCEPTED) {
    if (
      normalizeEmail(user.email) === normalizeEmail(invite.email) &&
      existing?.isActive
    ) {
      if (!user.emailVerifiedAt) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: now },
        });
      }

      return {
        ok: true,
        alreadyMember: true,
        businessId: invite.businessId,
        email: invite.email,
      };
    }

    return { ok: false, code: "NOT_PENDING" };
  }

  if (invite.expiresAt < now) {
    await prisma.businessInvite.update({
      where: { id: invite.id },
      data: { status: BusinessInviteStatus.EXPIRED },
    });
    return { ok: false, code: "EXPIRED" };
  }

  if (invite.status !== BusinessInviteStatus.PENDING) {
    return { ok: false, code: "NOT_PENDING" };
  }

  if (normalizeEmail(user.email) !== normalizeEmail(invite.email)) {
    return { ok: false, code: "EMAIL_MISMATCH" };
  }

  if (existing?.isActive) {
    await prisma.$transaction(async (tx) => {
      if (!user.emailVerifiedAt) {
        await tx.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: now },
        });
      }

      await tx.businessInvite.update({
        where: { id: invite.id },
        data: {
          status: BusinessInviteStatus.ACCEPTED,
          acceptedAt: now,
        },
      });
    });
    return {
      ok: true,
      alreadyMember: true,
      businessId: invite.businessId,
      email: invite.email,
    };
  }

  await prisma.$transaction(async (tx) => {
    if (!user.emailVerifiedAt) {
      await tx.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: now },
      });
    }

    await tx.businessMember.upsert({
      where: {
        businessId_userId: {
          businessId: invite.businessId,
          userId: user.id,
        },
      },
      create: {
        businessId: invite.businessId,
        userId: user.id,
        role: invite.role,
        isActive: true,
        title: invite.title,
      },
      update: {
        role: invite.role,
        isActive: true,
        title: invite.title ?? undefined,
      },
    });

    await tx.businessInvite.update({
      where: { id: invite.id },
      data: {
        status: BusinessInviteStatus.ACCEPTED,
        acceptedAt: now,
      },
    });
  });

  return { ok: true, businessId: invite.businessId, email: invite.email };
}

export async function revokeBusinessInvite(
  ownerUserId: string,
  businessId: string,
  inviteId: string,
): Promise<{ ok: true } | { ok: false; code: "NOT_OWNER" | "NOT_FOUND" | "NOT_PENDING" }> {
  const ownerOk = await isBusinessOwnerForInvites(ownerUserId, businessId);
  if (!ownerOk) {
    return { ok: false, code: "NOT_OWNER" };
  }

  const invite = await prisma.businessInvite.findFirst({
    where: { id: inviteId, businessId },
  });

  if (!invite) {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (invite.status !== BusinessInviteStatus.PENDING) {
    return { ok: false, code: "NOT_PENDING" };
  }

  await prisma.businessInvite.update({
    where: { id: invite.id },
    data: { status: BusinessInviteStatus.REVOKED },
  });

  return { ok: true };
}

export type ResendInviteResult =
  | { ok: true; acceptUrl: string }
  | { ok: false; code: "NOT_OWNER" | "NOT_FOUND" | "NOT_PENDING" | "EXPIRED" };

export async function resendBusinessInvite(
  ownerUserId: string,
  businessId: string,
  inviteId: string,
): Promise<ResendInviteResult> {
  const ownerOk = await isBusinessOwnerForInvites(ownerUserId, businessId);
  if (!ownerOk) {
    return { ok: false, code: "NOT_OWNER" };
  }

  const invite = await prisma.businessInvite.findFirst({
    where: { id: inviteId, businessId },
  });

  if (!invite) {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (invite.status !== BusinessInviteStatus.PENDING) {
    return { ok: false, code: "NOT_PENDING" };
  }

  const now = new Date();
  if (invite.expiresAt < now) {
    await prisma.businessInvite.update({
      where: { id: invite.id },
      data: { status: BusinessInviteStatus.EXPIRED },
    });
    return { ok: false, code: "EXPIRED" };
  }

  // Update the invite timestamp
  await prisma.businessInvite.update({
    where: { id: invite.id },
    data: { updatedAt: now },
  });

  const base = getPublicBaseUrl();
  const acceptPath = buildBusinessInviteAcceptPath(invite.token);
  const acceptUrl = `${base}${acceptPath}`;

  // Get business and inviter info for email
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });

  const inviter = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { displayName: true },
  });

  // Resend email
  try {
    await emailService.sendBusinessInvite({
      to: invite.email,
      businessName: business?.name || "бизнеса",
      inviterName: inviter?.displayName,
      acceptUrl,
      expiresInDays: 7,
    });
  } catch (error) {
    console.error("[businessInvite] Failed to resend invite email:", error);
    // Don't fail the resend if email fails
  }

  return { ok: true, acceptUrl };
}

export type DeleteInviteResult =
  | { ok: true }
  | { ok: false; code: "NOT_OWNER" | "NOT_FOUND" | "CANNOT_DELETE_ACTIVE" };

export async function deleteBusinessInvite(
  ownerUserId: string,
  businessId: string,
  inviteId: string,
): Promise<DeleteInviteResult> {
  const ownerOk = await isBusinessOwnerForInvites(ownerUserId, businessId);
  if (!ownerOk) {
    return { ok: false, code: "NOT_OWNER" };
  }

  const invite = await prisma.businessInvite.findFirst({
    where: { id: inviteId, businessId },
  });

  if (!invite) {
    return { ok: false, code: "NOT_FOUND" };
  }

  // Don't allow deleting active invites - they should be revoked first
  if (invite.status === BusinessInviteStatus.PENDING) {
    const now = new Date();
    if (invite.expiresAt > now) {
      return { ok: false, code: "CANNOT_DELETE_ACTIVE" };
    }
  }

  // Hard delete the invite
  await prisma.businessInvite.delete({
    where: { id: invite.id },
  });

  return { ok: true };
}
