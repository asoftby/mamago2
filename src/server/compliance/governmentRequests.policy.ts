import { z } from "zod";

// This module deliberately accepts case metadata only. Never add phone or
// decrypted profile data to these schemas.
export const createGovernmentRequestSchema = z.object({
  authorityName: z.string().trim().min(3).max(180),
  incomingNumber: z.string().trim().min(1).max(120),
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  legalBasis: z.string().trim().min(8).max(1000),
  requestedScope: z.string().trim().min(8).max(2000),
  subjectUserId: z.string().trim().min(8).max(120).optional().or(z.literal("")),
}).strict().superRefine((value, ctx) => {
  const date = new Date(value.receivedDate + "T00:00:00.000Z");
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value.receivedDate) {
    ctx.addIssue({ code: "custom", path: ["receivedDate"], message: "Invalid calendar date" });
  }
});

export const updateGovernmentRequestSchema = z.object({
  status: z.enum(["IN_REVIEW", "REJECTED", "CLOSED"]),
  resolutionNote: z.string().trim().max(2000).optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.status === "REJECTED" || value.status === "CLOSED") && !value.resolutionNote?.trim()) {
    ctx.addIssue({ code: "custom", path: ["resolutionNote"], message: "Resolution note is required" });
  }
});

export type CreateGovernmentRequestInput = z.infer<typeof createGovernmentRequestSchema>;
export type UpdateGovernmentRequestInput = z.infer<typeof updateGovernmentRequestSchema>;
export type GovernmentCaseStatus = "RECEIVED" | "IN_REVIEW" | "REJECTED" | "CLOSED";

export function canTransitionGovernmentRequest(from: GovernmentCaseStatus, to: GovernmentCaseStatus): boolean {
  return (from === "RECEIVED" && (to === "IN_REVIEW" || to === "REJECTED"))
    || (from === "IN_REVIEW" && (to === "REJECTED" || to === "CLOSED"));
}

/**
 * Browser-based mutations must be same-origin. Do not silently accept a
 * missing Origin header: server-to-server writes are intentionally disabled.
 * requestOrigin must be computed from the server request URL by the route.
 */
export function isAllowedGovernmentRequestOrigin(
  origin: string | null,
  requestOrigin: string,
  fetchSite: string | null,
): boolean {
  if (!origin || origin !== requestOrigin) return false;
  return fetchSite === null || fetchSite === "same-origin" || fetchSite === "none";
}
