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
import { sendEmail } from "@/lib/email/emailAdapter";

export const BUSINESS_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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
  title?: string | null;
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

  const invite = await prisma.businessInvite.create({
    data: {
      businessId: input.businessId,
      email,
      role: BusinessMemberRole.MANAGER,
      token,
      status: BusinessInviteStatus.PENDING,
      expiresAt,
      invitedById: input.invitedByUserId,
      title: input.title?.trim() || null,
    },
  });

  const base = getPublicBaseUrl();
  const acceptPath = `/api/business-invites/accept?token=${encodeURIComponent(token)}`;
  const acceptUrl = `${base}${acceptPath}`;

  await sendEmail({
    to: email,
    subject: "Приглашение в команду бизнеса",
    text: `Вы приглашены в команду. Откройте ссылку (действует 7 дней):\n${acceptUrl}`,
    html: `<p>Вы приглашены в команду.</p><p><a href="${acceptUrl}">Принять приглашение</a></p>`,
  }).catch(() => {});

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
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (env) {
    return env.startsWith("http") ? env.replace(/\/$/, "") : `https://${env.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export type AcceptInviteResult =
  | { ok: true; alreadyMember?: boolean; businessId: string }
  | {
      ok: false;
      code:
        | "INVITE_NOT_FOUND"
        | "EMAIL_MISMATCH"
        | "NOT_PENDING"
        | "EXPIRED"
        | "REVOKED";
    };

export async function acceptBusinessInvite(
  user: Pick<User, "id" | "email">,
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
  if (invite.status === BusinessInviteStatus.ACCEPTED) {
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

  if (invite.status !== BusinessInviteStatus.PENDING) {
    return { ok: false, code: "NOT_PENDING" };
  }

  if (normalizeEmail(user.email) !== normalizeEmail(invite.email)) {
    return { ok: false, code: "EMAIL_MISMATCH" };
  }

  const existing = await prisma.businessMember.findUnique({
    where: {
      businessId_userId: {
        businessId: invite.businessId,
        userId: user.id,
      },
    },
  });

  if (existing?.isActive) {
    await prisma.businessInvite.update({
      where: { id: invite.id },
      data: {
        status: BusinessInviteStatus.ACCEPTED,
        acceptedAt: now,
      },
    });
    return { ok: true, alreadyMember: true, businessId: invite.businessId };
  }

  await prisma.$transaction(async (tx) => {
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
        role: BusinessMemberRole.MANAGER,
        isActive: true,
        title: invite.title,
      },
      update: {
        role: BusinessMemberRole.MANAGER,
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

  return { ok: true, businessId: invite.businessId };
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
