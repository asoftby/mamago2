import prisma from "@/lib/prisma";
import type { Business } from "@prisma/client";
import { getOwnedBusinessForUser } from "@/server/permissions/business-permissions";
import {
  BusinessCreateSchema,
  BusinessUpdateSchema,
  type BusinessUpdateInput,
} from "./business.schema";

/**
 * Typed error class for Business operations
 */
export class BusinessError extends Error {
  constructor(
    message: string,
    public code: "BUSINESS_NOT_FOUND" | "BUSINESS_ALREADY_EXISTS"
  ) {
    super(message);
    this.name = "BusinessError";
  }
}

/**
 * Get owned business or throw (owner-only; not team membership).
 * @throws BusinessError with code "BUSINESS_NOT_FOUND" if business doesn't exist
 */
export async function assertMyBusiness(userId: string): Promise<Business> {
  const business = await getOwnedBusinessForUser(userId);

  if (!business) {
    throw new BusinessError("Business not found for user", "BUSINESS_NOT_FOUND");
  }

  return business;
}

/**
 * Create a new Business for the current user
 * @throws BusinessError with code "BUSINESS_ALREADY_EXISTS" if user already has a business
 * @throws ZodError if validation fails
 */
export async function createMyBusiness(
  userId: string,
  raw: unknown
): Promise<Business> {
  // Validate input
  const validated = BusinessCreateSchema.parse(raw);

  // Check if business already exists
  const existing = await getOwnedBusinessForUser(userId);
  if (existing) {
    throw new BusinessError(
      "User already has a business",
      "BUSINESS_ALREADY_EXISTS"
    );
  }

  // Create business
  const business = await prisma.business.create({
    data: {
      ownerUserId: userId,
      name: validated.name,
    },
  });

  return business;
}

/**
 * Update the Business for the current user
 * @throws BusinessError with code "BUSINESS_NOT_FOUND" if business doesn't exist
 * @throws ZodError if validation fails
 */
export async function updateMyBusiness(
  userId: string,
  raw: unknown
): Promise<Business> {
  // Validate input
  const validated = BusinessUpdateSchema.parse(raw);

  // Ensure business exists
  await assertMyBusiness(userId);

  // Build update data (only include provided fields)
  const updateData: Partial<BusinessUpdateInput> = {};
  if (validated.name !== undefined) {
    updateData.name = validated.name;
  }

  // Update business
  const business = await prisma.business.update({
    where: {
      ownerUserId: userId,
    },
    data: updateData,
  });

  return business;
}
