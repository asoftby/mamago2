import "server-only";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { normalizePhoneToE164 } from "@/lib/phone/phoneNormalize";
import { getBusinessMembership } from "@/server/permissions/business-permissions";
import { notifySupportBusinessAccessRequest } from "@/server/support/supportTelegram";
import {
  BusinessAccessRequesterRole,
  BusinessMemberRole,
  type BusinessAccessRequest,
} from "@prisma/client";

export const businessAccessRequestSchema = z
  .object({
    unp: z.string().regex(/^[0-9]{9}$/, "УНП должен содержать 9 цифр"),
    name: z.string().trim().min(2, "Укажите имя").max(200),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().email("Некорректный email").max(200).optional(),
    requesterRole: z.nativeEnum(BusinessAccessRequesterRole),
    comment: z.string().trim().max(2000).optional(),
  })
  .refine((data) => Boolean(data.phone) || Boolean(data.email), {
    message: "Укажите телефон или email для связи",
    path: ["phone"],
  });

export type BusinessAccessRequestInput = z.infer<typeof businessAccessRequestSchema>;

export type CreateBusinessAccessRequestResult =
  | { ok: true; request: BusinessAccessRequest }
  | { ok: true; alreadyPending: true; request: BusinessAccessRequest }
  | {
      ok: false;
      code:
        | "BUSINESS_NOT_FOUND_BY_UNP"
        | "BUSINESS_ALREADY_OWNED_BY_USER"
        | "BUSINESS_ALREADY_ACCESSIBLE";
      message: string;
    };

/**
 * Creates a BusinessAccessRequest for `requesterUserId` against the Business matching `unp`.
 * Never creates a duplicate PENDING request for the same (business, requester) pair.
 */
export async function createBusinessAccessRequest(
  requesterUserId: string,
  input: BusinessAccessRequestInput,
): Promise<CreateBusinessAccessRequestResult> {
  const business = await prisma.business.findUnique({
    where: { unp: input.unp },
    select: { id: true, ownerUserId: true },
  });

  if (!business) {
    return {
      ok: false,
      code: "BUSINESS_NOT_FOUND_BY_UNP",
      message: "Бизнес с таким УНП не найден.",
    };
  }

  if (business.ownerUserId === requesterUserId) {
    return {
      ok: false,
      code: "BUSINESS_ALREADY_OWNED_BY_USER",
      message: "Этот бизнес уже связан с вашим аккаунтом.",
    };
  }

  const existingMembership = await getBusinessMembership(requesterUserId, business.id);
  if (existingMembership) {
    return {
      ok: false,
      code: "BUSINESS_ALREADY_ACCESSIBLE",
      message: "У вас уже есть доступ к этому бизнесу.",
    };
  }

  const existingPending = await prisma.businessAccessRequest.findFirst({
    where: { businessId: business.id, requesterUserId, status: "PENDING" },
  });
  if (existingPending) {
    return { ok: true, alreadyPending: true, request: existingPending };
  }

  const phone = input.phone ? normalizePhoneToE164(input.phone) : undefined;

  const request = await prisma.businessAccessRequest.create({
    data: {
      businessId: business.id,
      requesterUserId,
      unp: input.unp,
      name: input.name,
      phone,
      email: input.email,
      requesterRole: input.requesterRole,
      comment: input.comment,
    },
  });

  notifySupportBusinessAccessRequest({
    requestId: request.id,
    businessId: business.id,
    unp: input.unp,
    requesterName: input.name,
    requesterUserId,
    phone,
    email: input.email,
    requesterRole: input.requesterRole,
    comment: input.comment,
  }).catch((e) => console.error("[businessAccessRequest] telegram notify failed:", e));

  return { ok: true, request };
}

export class BusinessAccessRequestReviewError extends Error {
  constructor(
    message: string,
    public code: "REQUEST_NOT_FOUND" | "REQUEST_NOT_PENDING",
  ) {
    super(message);
    this.name = "BusinessAccessRequestReviewError";
  }
}

async function getPendingRequestOrThrow(requestId: string) {
  const request = await prisma.businessAccessRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    throw new BusinessAccessRequestReviewError("Request not found", "REQUEST_NOT_FOUND");
  }
  if (request.status !== "PENDING") {
    throw new BusinessAccessRequestReviewError(
      `Cannot review from status: ${request.status}`,
      "REQUEST_NOT_PENDING",
    );
  }
  return request;
}

/**
 * Approves a PENDING BusinessAccessRequest: grants the requester a MANAGER
 * BusinessMember (idempotent upsert), never touches Business.ownerUserId.
 */
export async function approveBusinessAccessRequest(
  requestId: string,
  adminUserId: string,
): Promise<void> {
  const request = await getPendingRequestOrThrow(requestId);
  const now = new Date();

  await prisma.$transaction([
    prisma.businessMember.upsert({
      where: {
        businessId_userId: { businessId: request.businessId, userId: request.requesterUserId },
      },
      create: {
        businessId: request.businessId,
        userId: request.requesterUserId,
        role: BusinessMemberRole.MANAGER,
        isActive: true,
      },
      update: { role: BusinessMemberRole.MANAGER, isActive: true },
    }),
    prisma.businessAccessRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", reviewedAt: now, reviewedByAdminId: adminUserId },
    }),
  ]);
}

/** Rejects a PENDING BusinessAccessRequest. The request row is kept, not deleted. */
export async function rejectBusinessAccessRequest(
  requestId: string,
  adminUserId: string,
): Promise<void> {
  await getPendingRequestOrThrow(requestId);

  await prisma.businessAccessRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", reviewedAt: new Date(), reviewedByAdminId: adminUserId },
  });
}
