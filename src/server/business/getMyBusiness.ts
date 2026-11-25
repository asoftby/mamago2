"use server";

import prisma from "@/lib/prisma";
import type { Business } from "@prisma/client";
import {
  getOwnedBusinessForUser,
  getPartnerCabinetBusiness,
} from "@/server/permissions/business-permissions";

/** Canonical partner cabinet business from active OWNER/MANAGER membership. */
export async function getMyBusiness(userId: string, bookingId?: string): Promise<Business | null> {
  if (bookingId) {
    const booking = await prisma.bookingRequest.findFirst({
      where: { id: bookingId, business: { members: { some: {
        userId, isActive: true, role: { in: ["OWNER", "MANAGER"] },
      } } } },
      select: { business: true },
    });
    return booking?.business ?? null;
  }
  return getPartnerCabinetBusiness(userId);
}

/** Ownership metadata for onboarding/billing only; never use as an auth guard. */
export async function getOwnedBusinessProfile(userId: string): Promise<Business | null> {
  return getOwnedBusinessForUser(userId);
}
