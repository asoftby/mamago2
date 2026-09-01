import {
  BusinessMemberRole,
  BusinessVerificationStatus,
  type Prisma,
  type User,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCanonicalPublicAppUrl } from "@/lib/config/publicAppUrl";

export const BUSINESS_VERIFICATION_STATUSES = [
  BusinessVerificationStatus.DRAFT,
  BusinessVerificationStatus.PENDING,
  BusinessVerificationStatus.NEEDS_INFO,
  BusinessVerificationStatus.APPROVED,
  BusinessVerificationStatus.REJECTED,
] as const;

export type BusinessVerificationStatusValue =
  (typeof BUSINESS_VERIFICATION_STATUSES)[number];

export type BusinessVerificationSummary = {
  id: string;
  ownerUserId: string;
  name: string;
  legalName: string | null;
  unp: string | null;
  phone: string | null;
  operationalStatus: "ACTIVE" | "DISABLED" | "ARCHIVED";
  verificationStatus: BusinessVerificationStatusValue;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  reviewNote: string | null;
  isVerified: boolean;
  owner: Pick<User, "id" | "email" | "displayName">;
};

export type BusinessVerificationListOptions = {
  status?: BusinessVerificationStatusValue;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listVerificationRequests(
  options: BusinessVerificationListOptions = {},
): Promise<BusinessVerificationSummary[]> {
  const where: Prisma.BusinessWhereInput = {};
  if (options.status) where.verificationStatus = options.status;
  if (options.search?.trim()) {
    const q = options.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { legalName: { contains: q, mode: "insensitive" } },
      { unp: { contains: q, mode: "insensitive" } },
      { owner: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  return prisma.business.findMany({
    where,
    select: {
      id: true,
      ownerUserId: true,
      name: true,
      legalName: true,
      unp: true,
      phone: true,
      operationalStatus: true,
      verificationStatus: true,
      submittedAt: true,
      reviewedAt: true,
      approvedAt: true,
      rejectedAt: true,
      reviewNote: true,
      isVerified: true,
      owner: { select: { id: true, email: true, displayName: true } },
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    take: options.limit ?? 100,
    skip: options.offset ?? 0,
  });
}

export async function getVerificationRequest(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    include: {
      owner: { select: { id: true, email: true, displayName: true } },
      verificationLogs: {
        orderBy: { createdAt: "desc" },
        include: {
          reviewedBy: { select: { id: true, email: true, displayName: true } },
        },
      },
    },
  });
}

export async function submitForVerification(
  businessId: string,
  ownerUserId: string,
): Promise<void> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business || business.ownerUserId !== ownerUserId) {
    throw new Error("Business not found");
  }

  if (
    business.verificationStatus !== BusinessVerificationStatus.DRAFT &&
    business.verificationStatus !== BusinessVerificationStatus.NEEDS_INFO &&
    business.verificationStatus !== BusinessVerificationStatus.REJECTED
  ) {
    throw new Error("Business cannot be submitted from current status");
  }

  const now = new Date();
  const statusFrom = business.verificationStatus;
  await prisma.$transaction([
    prisma.business.update({
      where: { id: businessId },
      data: {
        verificationStatus: BusinessVerificationStatus.PENDING,
        submittedAt: now,
        reviewNote: null,
      },
    }),
    prisma.businessVerificationLog.create({
      data: {
        businessId,
        statusFrom,
        statusTo: BusinessVerificationStatus.PENDING,
        note: "Submitted for verification",
      },
    }),
  ]);
}

export async function approve(
  businessId: string,
  actorUserId: string,
  note?: string | null,
): Promise<void> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new Error("Business not found");
  if (business.verificationStatus !== BusinessVerificationStatus.PENDING) {
    throw new Error("Only pending business can be approved");
  }

  const now = new Date();
  const statusFrom = business.verificationStatus;
  const statusTo = BusinessVerificationStatus.APPROVED;

  await prisma.$transaction([
    prisma.business.update({
      where: { id: businessId },
      data: {
        verificationStatus: statusTo,
        reviewedAt: now,
        reviewedByUserId: actorUserId,
        reviewNote: note || null,
        approvedAt: now,
        rejectedAt: null,
        isVerified: true,
        operationalStatus: "ACTIVE",
        status: "APPROVED",
      },
    }),
    prisma.businessVerificationLog.create({
      data: {
        businessId,
        statusFrom,
        statusTo,
        note: note || "Approved",
        reviewedByUserId: actorUserId,
      },
    }),
    // Canonical partner authorization is BusinessMember. User.role is not changed.
    prisma.businessMember.upsert({
      where: { businessId_userId: { businessId, userId: business.ownerUserId } },
      create: {
        businessId,
        userId: business.ownerUserId,
        role: BusinessMemberRole.OWNER,
        isActive: true,
      },
      update: { role: BusinessMemberRole.OWNER, isActive: true },
    }),
  ]);

  const full = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, ownerUserId: true },
  });
  if (full) {
    const { notifyBusinessVerified } = await import("./notification.service");
    notifyBusinessVerified(businessId, full.name, full.ownerUserId).catch((e) =>
      console.error("[businessVerification] notifyBusinessVerified failed:", e),
    );
  }
}

export async function reject(
  businessId: string,
  actorUserId: string,
  note: string,
): Promise<void> {
  if (!note.trim()) throw new Error("Rejection note is required");

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new Error("Business not found");
  if (business.verificationStatus !== BusinessVerificationStatus.PENDING) {
    throw new Error("Only pending business can be rejected");
  }

  const now = new Date();
  const statusFrom = business.verificationStatus;
  await prisma.$transaction([
    prisma.business.update({
      where: { id: businessId },
      data: {
        verificationStatus: BusinessVerificationStatus.REJECTED,
        reviewedAt: now,
        reviewedByUserId: actorUserId,
        reviewNote: note.trim(),
        rejectedAt: now,
        isVerified: false,
      },
    }),
    prisma.businessVerificationLog.create({
      data: {
        businessId,
        statusFrom,
        statusTo: BusinessVerificationStatus.REJECTED,
        note: note.trim(),
        reviewedByUserId: actorUserId,
      },
    }),
  ]);
}

export async function requestInfo(
  businessId: string,
  actorUserId: string,
  note: string,
): Promise<void> {
  if (!note.trim()) throw new Error("Request note is required");

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new Error("Business not found");
  if (business.verificationStatus !== BusinessVerificationStatus.PENDING) {
    throw new Error("Only pending business can request more info");
  }

  const now = new Date();
  const statusFrom = business.verificationStatus;
  await prisma.$transaction([
    prisma.business.update({
      where: { id: businessId },
      data: {
        verificationStatus: BusinessVerificationStatus.NEEDS_INFO,
        reviewedAt: now,
        reviewedByUserId: actorUserId,
        reviewNote: note.trim(),
        isVerified: false,
      },
    }),
    prisma.businessVerificationLog.create({
      data: {
        businessId,
        statusFrom,
        statusTo: BusinessVerificationStatus.NEEDS_INFO,
        note: note.trim(),
        reviewedByUserId: actorUserId,
      },
    }),
  ]);
}

export function canPublish(status: BusinessVerificationStatusValue): boolean {
  return status === BusinessVerificationStatus.APPROVED;
}

export function getVerificationStatusLabel(status: BusinessVerificationStatusValue): string {
  switch (status) {
    case BusinessVerificationStatus.DRAFT:
      return "Черновик";
    case BusinessVerificationStatus.PENDING:
      return "На проверке";
    case BusinessVerificationStatus.NEEDS_INFO:
      return "Нужна информация";
    case BusinessVerificationStatus.APPROVED:
      return "Подтверждено";
    case BusinessVerificationStatus.REJECTED:
      return "Отклонено";
  }
}

export function getVerificationPublicUrl(): string {
  return `${getCanonicalPublicAppUrl()}/business`;
}
