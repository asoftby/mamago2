import { z } from "zod";

// Base schema without refinements
const broadcastSchemaBase = z.object({
  title: z.string().min(1, "Заголовок обязателен").max(200, "Максимум 200 символов"),
  summary: z.string().max(500, "Максимум 500 символов").optional().nullable(),
  body: z.string().min(1, "Текст сообщения обязателен"),
  type: z.enum(["NEWS", "ANNOUNCEMENT", "SYSTEM"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).default("NORMAL"),
  audienceType: z.enum(["BUSINESS", "USER", "ALL"]).default("BUSINESS"),
  ctaLabel: z.string().max(100).optional().nullable(),
  ctaUrl: z.string().url("Некорректный URL").max(2000).optional().nullable(),
  showInInbox: z.boolean().default(true),
  sendEmail: z.boolean().default(false),
  pinToDashboard: z.boolean().default(false),
  scheduledAt: z.string().datetime().optional().nullable(),
});

// Create schema with refinements
export const createBroadcastSchema = broadcastSchemaBase.refine(
  (data) => {
    // Если задан ctaLabel — ctaUrl тоже должен быть
    if (data.ctaLabel && !data.ctaUrl) return false;
    return true;
  },
  { message: "Если задан текст кнопки, укажите и ссылку", path: ["ctaUrl"] },
);

// Update schema: partial base schema with the same refinement
export const updateBroadcastSchema = broadcastSchemaBase.partial().refine(
  (data) => {
    // Если задан ctaLabel — ctaUrl тоже должен быть
    if (data.ctaLabel && !data.ctaUrl) return false;
    return true;
  },
  { message: "Если задан текст кнопки, укажите и ссылку", path: ["ctaUrl"] },
);

export const listBroadcastsSchema = z.object({
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).optional(),
  type: z.enum(["NEWS", "ANNOUNCEMENT", "SYSTEM"]).optional(),
  audienceType: z.enum(["BUSINESS", "USER", "ALL"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;
export type UpdateBroadcastInput = z.infer<typeof updateBroadcastSchema>;
export type ListBroadcastsFilters = z.infer<typeof listBroadcastsSchema>;
