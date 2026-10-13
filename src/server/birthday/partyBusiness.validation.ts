import { z } from "zod";

export const partyBusinessReplySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("AS_REQUESTED"),
    expectedStage: z.enum(["SENT", "AWAITING_RECONFIRM"]),
    expectedQuoteVersion: z.number().int().nonnegative(),
    priceByn: z.number().positive().max(1_000_000),
    includes: z.string().trim().min(1).max(2000),
    durationMinutes: z.number().int().min(15).max(1440).optional(),
    prepaymentTerms: z.string().trim().max(2000).optional(),
    cancellationTerms: z.string().trim().max(2000).optional(),
  }).strict(),
  z.object({
    type: z.literal("MODIFIED"),
    expectedStage: z.enum(["SENT", "AWAITING_RECONFIRM"]),
    expectedQuoteVersion: z.number().int().nonnegative(),
    priceByn: z.number().positive().max(1_000_000),
    includes: z.string().trim().min(1).max(2000),
    durationMinutes: z.number().int().min(15).max(1440).optional(),
    changeReason: z.string().trim().min(5).max(2000),
    prepaymentTerms: z.string().trim().max(2000).optional(),
    cancellationTerms: z.string().trim().max(2000).optional(),
  }).strict(),
  z.object({
    type: z.literal("DECLINED"),
    expectedStage: z.enum(["SENT", "AWAITING_RECONFIRM"]),
    expectedQuoteVersion: z.number().int().nonnegative(),
    declineReason: z.enum(["DATE_BUSY", "BUDGET", "FORMAT", "NOT_ENOUGH_TIME", "OTHER"]),
    declineComment: z.string().trim().max(2000).optional(),
  }).strict().refine((v) => v.declineReason !== "OTHER" || Boolean(v.declineComment?.trim()), {
    message: "Укажите причину отказа",
    path: ["declineComment"],
  }),
]);

export type PartyBusinessReply = z.infer<typeof partyBusinessReplySchema>;

export const PARTY_ATTENTION_STAGES = ["SENT", "AWAITING_RECONFIRM"] as const;
export function isPartyAttentionStage(stage: string | null): boolean {
  return stage === "SENT" || stage === "AWAITING_RECONFIRM";
}
