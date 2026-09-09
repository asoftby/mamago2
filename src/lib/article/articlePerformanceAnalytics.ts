import { z } from "zod";
import { ArticleBlockEntityTypeSchema } from "@/lib/publications/articleMvp";

export const ARTICLE_PERFORMANCE_ANALYTICS_SCOPE = "article_performance_batch_v1" as const;
export const ARTICLE_PERFORMANCE_BATCH_MAX_EVENTS = 80;
export const ARTICLE_PERFORMANCE_BATCH_MAX_BYTES = 32 * 1024;

export const ArticlePerformanceTrackedBlockTypeSchema = z.enum([
  "contacts",
  "price",
  "openingHours",
  "activityCard",
]);
export type ArticlePerformanceTrackedBlockType = z.infer<typeof ArticlePerformanceTrackedBlockTypeSchema>;

export const ArticlePerformanceActionSchema = z.enum([
  "phone",
  "route",
  "coordinates",
  "email",
  "website",
  "social",
  "card_open",
]);
export type ArticlePerformanceAction = z.infer<typeof ArticlePerformanceActionSchema>;

const identity = z.object({
  blockId: z.string().trim().min(1).max(160),
  blockType: ArticlePerformanceTrackedBlockTypeSchema,
  subjectId: z.string().trim().min(1).max(200).optional(),
  subjectTitle: z.string().trim().min(1).max(200).optional(),
  subjectSource: z.enum(["MANUAL", "CATALOG"]).optional(),
  catalogEntityType: ArticleBlockEntityTypeSchema.optional(),
  catalogEntityId: z.string().trim().min(1).max(200).optional(),
});

export const ArticlePerformanceBatchEventSchema = z.discriminatedUnion("kind", [
  identity.extend({ kind: z.literal("impression") }),
  identity.extend({
    kind: z.literal("action"),
    action: ArticlePerformanceActionSchema,
    actionItemId: z.string().trim().min(1).max(120).optional(),
  }),
]);
export type ArticlePerformanceBatchEvent = z.infer<typeof ArticlePerformanceBatchEventSchema>;

export const ArticlePerformanceBatchSchema = z.object({
  sessionId: z.string().trim().min(1).max(120),
  events: z.array(ArticlePerformanceBatchEventSchema).min(1).max(ARTICLE_PERFORMANCE_BATCH_MAX_EVENTS),
});
export type ArticlePerformanceBatch = z.infer<typeof ArticlePerformanceBatchSchema>;

export type ArticlePerformanceBlockDescriptor = Omit<
  Extract<ArticlePerformanceBatchEvent, { kind: "impression" }>,
  "kind"
>;
