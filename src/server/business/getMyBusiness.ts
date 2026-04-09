"use server";

import type { Business } from "@prisma/client";
import {
  getOwnedBusinessForUser,
  getPartnerCabinetBusiness,
} from "@/server/permissions/business-permissions";

/**
 * Business for the partner cabinet: active membership (OWNER/MANAGER), else owned row (no member yet).
 */
export async function getMyBusiness(userId: string): Promise<Business | null> {
  return getPartnerCabinetBusiness(userId);
}

/** Business the user owns (`ownerUserId`). Onboarding / billing — not team membership. */
export async function getOwnedBusinessProfile(userId: string): Promise<Business | null> {
  return getOwnedBusinessForUser(userId);
}
