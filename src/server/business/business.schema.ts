import { z } from "zod";

/**
 * Schema for creating a new Business
 * Matches current Prisma model: id, name, ownerUserId, createdAt, updatedAt
 */
export const BusinessCreateSchema = z.object({
  name: z.string().min(2).max(120),
});

export type BusinessCreateInput = z.infer<typeof BusinessCreateSchema>;

/**
 * Schema for updating an existing Business
 * All fields are optional
 */
export const BusinessUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
});

export type BusinessUpdateInput = z.infer<typeof BusinessUpdateSchema>;
