/**
 * Business Verification Service
 * Centralizes business verification workflow logic
 * Server-only - do not import in client components
 */

import prisma from "@/lib/prisma";
import { BusinessVerificationStatus } from "@prisma/client";
import { notifyAdminBusinessVerificationPending } from "@/lib/admin/notifyAdminBusinessVerification";

/**
 * Submit business for verification
 * Allowed only if status is DRAFT, REJECTED, or NEEDS_INFO
 */
export async function submitForVerification(
  businessId: string,
  actorUserId: string
): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { verificationStatus: true, ownerUserId: true },
  });

  if (!business) {
    throw new Error("Business not found");
  }

  if (business.ownerUserId !== actorUserId) {
    throw new Error("Unauthorized: not business owner");
  }

  if (
    business.verificationStatus !== "DRAFT" &&
    business.verificationStatus !== "REJECTED" &&
    business.verificationStatus !== "NEEDS_INFO"
  ) {
    throw new Error(
      `Cannot submit from status: ${business.verificationStatus}`
    );
  }

  const now = new Date();
  const statusFrom = business.verificationStatus;
  const statusTo: BusinessVerificationStatus = "PENDING";

  await prisma.$transaction([
    // Update business status
    prisma.business.update({
      where: { id: businessId },
      data: {
        verificationStatus: statusTo,
        submittedAt: now,
        reviewedAt: null,
        reviewedByUserId: null,
        reviewNote: null,
        approvedAt: null,
        rejectedAt: null,
      },
    }),

    // Create log entry
    prisma.businessVerificationLog.create({
      data: {
        businessId,
        statusFrom,
        statusTo,
        note: "Submitted for verification",
        reviewedByUserId: null,
      },
    }),
  ]);

  const full = await prisma.business.findUnique({
    where: { id: businessId },
    include: { owner: { select: { email: true } } },
  });
  if (full) {
    notifyAdminBusinessVerificationPending({
      businessId: full.id,
      name: full.name,
      legalName: full.legalName,
      unp: full.unp,
      ownerEmail: full.owner.email,
    });
  }
}

/**
 * Approve business verification
 * Allowed only if status is PENDING
 */
export async function approve(
  businessId: string,
  actorUserId: string,
  note?: string
): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { verificationStatus: true },
  });

  if (!business) {
    throw new Error("Business not found");
  }

  if (business.verificationStatus !== "PENDING") {
    throw new Error(
      `Cannot approve from status: ${business.verificationStatus}`
    );
  }

  const now = new Date();
  const statusFrom = business.verificationStatus;
  const statusTo: BusinessVerificationStatus = "APPROVED";

  await prisma.$transaction([
    // Update business status
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
        /** Заявка одобрена — бизнес снова/впервые доступен пользователям сайта */
        operationalStatus: "ACTIVE",
        /** Legacy поле onboarding */
        status: "APPROVED",
      },
    }),

    // Create log entry
    prisma.businessVerificationLog.create({
      data: {
        businessId,
        statusFrom,
        statusTo,
        note: note || "Approved",
        reviewedByUserId: actorUserId,
      },
    }),
  ]);
}

/**
 * Reject business verification
 * Allowed only if status is PENDING
 * Note is required
 */
export async function reject(
  businessId: string,
  actorUserId: string,
  note: string
): Promise<void> {
  if (!note || note.trim().length === 0) {
    throw new Error("Rejection note is required");
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { verificationStatus: true },
  });

  if (!business) {
    throw new Error("Business not found");
  }

  if (business.verificationStatus !== "PENDING") {
    throw new Error(
      `Cannot reject from status: ${business.verificationStatus}`
    );
  }

  const now = new Date();
  const statusFrom = business.verificationStatus;
  const statusTo: BusinessVerificationStatus = "REJECTED";

  await prisma.$transaction([
    // Update business status
    prisma.business.update({
      where: { id: businessId },
      data: {
        verificationStatus: statusTo,
        reviewedAt: now,
        reviewedByUserId: actorUserId,
        reviewNote: note,
        approvedAt: null,
        rejectedAt: now,
      },
    }),

    // Create log entry
    prisma.businessVerificationLog.create({
      data: {
        businessId,
        statusFrom,
        statusTo,
        note,
        reviewedByUserId: actorUserId,
      },
    }),
  ]);
}

/**
 * Request more information from business owner
 * Allowed only if status is PENDING
 * Note is required
 */
export async function needsInfo(
  businessId: string,
  actorUserId: string,
  note: string
): Promise<void> {
  if (!note || note.trim().length === 0) {
    throw new Error("Comment is required for NEEDS_INFO status");
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { verificationStatus: true },
  });

  if (!business) {
    throw new Error("Business not found");
  }

  if (business.verificationStatus !== "PENDING") {
    throw new Error(
      `Cannot request info from status: ${business.verificationStatus}`
    );
  }

  const now = new Date();
  const statusFrom = business.verificationStatus;
  const statusTo: BusinessVerificationStatus = "NEEDS_INFO";

  await prisma.$transaction([
    // Update business status
    prisma.business.update({
      where: { id: businessId },
      data: {
        verificationStatus: statusTo,
        reviewedAt: now,
        reviewedByUserId: actorUserId,
        reviewNote: note,
        approvedAt: null,
        rejectedAt: null,
      },
    }),

    // Create log entry
    prisma.businessVerificationLog.create({
      data: {
        businessId,
        statusFrom,
        statusTo,
        note,
        reviewedByUserId: actorUserId,
      },
    }),
  ]);
}

/**
 * Check if business can publish content (Place/Offer/Event)
 * Only APPROVED businesses can publish
 */
export function canPublish(
  status: BusinessVerificationStatus
): boolean {
  return status === "APPROVED";
}
