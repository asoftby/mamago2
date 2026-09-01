"use server";

import type { Business } from "@prisma/client";
import {
  getOwnedBusinessForUser,
  getPartnerCabinetBusiness,
} from "@/server/permissions/business-permissions";

/** Canonical partner cabinet business from active OWNER/MANAGER membership. */
export async function getMyBusiness(userId: string): Promise<Business | null> {
  return getPartnerCabinetBusiness(userId);
}

/** Ownership metadata for onboarding/billing only; never use as an auth guard. */
export async function getOwnedBusinessProfile(userId: string): Promise<Business | null> {
  return getOwnedBusinessForUser(userId);
}
