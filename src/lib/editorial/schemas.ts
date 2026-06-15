import { EditorialRequestStatus } from "@prisma/client";
import { z } from "zod";

export const editorialRequestCriteriaSchema = z.object({
  discoverySignalIds: z.array(z.string().min(1)).default([]),
  classChipSlugs: z.array(z.string().min(1)).default([]),
});

export type EditorialRequestCriteriaInput = z.infer<
  typeof editorialRequestCriteriaSchema
>;

export const editorialRequestInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z
    .string()
    .trim()
    .max(5000)
    .nullable()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  cityId: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  status: z.nativeEnum(EditorialRequestStatus).default(
    EditorialRequestStatus.DRAFT,
  ),
  deadlineAt: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  criteria: editorialRequestCriteriaSchema.default({
    discoverySignalIds: [],
    classChipSlugs: [],
  }),
});

export type EditorialRequestInput = z.infer<typeof editorialRequestInputSchema>;

export const editorialRequestListQuerySchema = z.object({
  status: z.nativeEnum(EditorialRequestStatus).optional(),
});

export type EditorialRequestListQuery = z.infer<
  typeof editorialRequestListQuerySchema
>;

export function normalizeEditorialRequestCriteria(
  raw: unknown,
): EditorialRequestCriteriaInput {
  const parsed = editorialRequestCriteriaSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }

  return {
    discoverySignalIds: [],
    classChipSlugs: [],
  };
}
