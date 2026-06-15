import { z } from "zod";

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

const nullableText = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => emptyToNull(value));

export const releaseNoteInputSchema = z.object({
  type: z.enum(["feature", "fix", "improvement", "security"]),
  title: z.string().trim().min(2),
  description: nullableText,
});

export const createReleaseInputSchema = z.object({
  version: z.string().trim().min(1),
  title: z.string().trim().min(2),
  notes: z.array(releaseNoteInputSchema).max(50).default([]),
});

export const updateReleaseInputSchema = z.object({
  version: z.string().trim().min(1).optional(),
  title: z.string().trim().min(2).optional(),
  notes: z.array(releaseNoteInputSchema).max(50).optional(),
});

export type ReleaseNoteInputParsed = z.infer<typeof releaseNoteInputSchema>;
export type CreateReleaseInputParsed = z.infer<typeof createReleaseInputSchema>;
export type UpdateReleaseInputParsed = z.infer<typeof updateReleaseInputSchema>;
