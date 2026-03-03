"use server";

import prisma from "@/lib/prisma";
import type { Business } from "@prisma/client";

/**
 * Get the Business for the current user (one business per owner for MVP)
 */
export async function getMyBusiness(userId: string): Promise<Business | null> {
  const business = await prisma.business.findUnique({
    where: {
      ownerUserId: userId,
    },
  });

  return business;
}
