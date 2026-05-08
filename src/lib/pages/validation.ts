import { z } from "zod";
import { PageType, PageStatus, PageVisibility } from "@prisma/client";

/**
 * Нормализация slug: lowercase, kebab-case, без пробелов
 */
export function normalizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Генерация slug из title
 */
export function generateSlugFromTitle(title: string): string {
  return normalizeSlug(title);
}

/**
 * Schema для создания страницы
 */
export const CreatePageSchema = z.object({
  title: z.string().min(1, "Название обязательно").max(200),
  slug: z.string().min(1, "Slug обязателен").max(200),
  type: z.nativeEnum(PageType),
  status: z.nativeEnum(PageStatus).optional().default("DRAFT"),
  visibility: z.nativeEnum(PageVisibility).optional().default("PUBLIC"),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().optional().nullable(),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(500).optional().nullable(),
  ogImageUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export type CreatePageInput = z.infer<typeof CreatePageSchema>;

/**
 * Schema для обновления страницы
 */
export const UpdatePageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).optional(),
  type: z.nativeEnum(PageType).optional(),
  status: z.nativeEnum(PageStatus).optional(),
  visibility: z.nativeEnum(PageVisibility).optional(),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().optional().nullable(),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(500).optional().nullable(),
  ogImageUrl: z.string().url().optional().nullable().or(z.literal("")),
});

export type UpdatePageInput = z.infer<typeof UpdatePageSchema>;

/**
 * Schema для query параметров списка страниц
 */
export const ListPagesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.nativeEnum(PageStatus).optional(),
  type: z.nativeEnum(PageType).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["updatedAt", "createdAt", "publishedAt", "title"]).optional().default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type ListPagesQuery = z.infer<typeof ListPagesQuerySchema>;
