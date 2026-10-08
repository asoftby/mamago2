import { z } from "zod";
import { AgeRangesRequestSchema } from "@/lib/decision/decisionContext";
import { SafeOpaqueIdSchema } from "@/lib/decision/identifiers";

/**
 * Request contract for POST /api/plan/generate. Kept out of the route file
 * (Next.js route modules may only export handlers) so it is directly testable.
 * Age ranges are canonical + bounded and the guest identity is a bounded
 * opaque id — malformed input is rejected, never trimmed or persisted.
 */
export const guestGenerateBodySchema = z.object({
  anonymousId: SafeOpaqueIdSchema.optional().nullable(),
  city: z.string().min(1).optional().default("minsk"),
  date: z.string().optional(),
  exclude: z.array(z.string()).optional(),
  ageRanges: AgeRangesRequestSchema.optional(),
});
