import { z } from "zod";
import {
  extractPlainTextFromHtml,
  extractPlainTextLinesFromHtml,
} from "@/lib/richtext/utils";
import { articleBlockHtmlForPublic } from "@/lib/article/articleBlockHtml";
import { randomId } from "@/lib/utils/randomId";

/** Версия формата `Article.contentJson` */
export const ARTICLE_CONTENT_VERSION = 1 as const;

export const ArticleBlockEntityTypeSchema = z.enum(["EVENT", "PLACE", "OFFER", "ROUTE", "ARTICLE"]);
export type ArticleBlockEntityType = z.infer<typeof ArticleBlockEntityTypeSchema>;

const base = z.object({ id: z.string().min(1) });

export const ArticleBlockMvpSchema = z.discriminatedUnion("type", [
  base.extend({
    type: z.literal("intro"),
    text: z.string(),
  }),
  base.extend({
    type: z.literal("text"),
    text: z.string(),
  }),
  base.extend({
    type: z.literal("quote"),
    text: z.string(),
    attribution: z.string().optional(),
    authorRole: z.string().optional(),
  }),
  base.extend({
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3)]),
    text: z.string(),
  }),
  base.extend({
    type: z.literal("image"),
    mediaId: z.string(),
    alt: z.string().optional(),
    caption: z.string().optional(),
  }),
  base.extend({
    type: z.literal("gallery"),
    mediaIds: z.array(z.string()),
    caption: z.string().optional(),
  }),
  base.extend({
    type: z.literal("activityCard"),
    entityType: ArticleBlockEntityTypeSchema,
    entityId: z.string(),
  }),
  base.extend({
    type: z.literal("embed"),
    embedHtml: z.string(),
    caption: z.string().optional(),
  }),
]);

export type ArticleBlockMvp = z.infer<typeof ArticleBlockMvpSchema>;

export const ArticleContentPayloadSchema = z.object({
  version: z.literal(ARTICLE_CONTENT_VERSION),
  blocks: z.array(ArticleBlockMvpSchema),
});

export type ArticleContentPayload = z.infer<typeof ArticleContentPayloadSchema>;

export function parseArticleContentJson(raw: unknown): ArticleContentPayload {
  const fallback: ArticleContentPayload = { version: ARTICLE_CONTENT_VERSION, blocks: [] };
  if (raw == null || typeof raw !== "object") return fallback;
  const parsed = ArticleContentPayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : fallback;
}

export function serializeArticleContent(payload: ArticleContentPayload): object {
  return JSON.parse(JSON.stringify(payload)) as object;
}

export function emptyArticleContent(): ArticleContentPayload {
  return { version: ARTICLE_CONTENT_VERSION, blocks: [] };
}

/** Стартовая структура для новой статьи: лид + абзац (только при создании черновика). */
export function articleStarterContent(): ArticleContentPayload {
  return {
    version: ARTICLE_CONTENT_VERSION,
    blocks: [newBlock("intro"), newBlock("text")],
  };
}

const ARTICLE_LEAD_EXCERPT_MAX = 220;

/** Полный лид статьи (блок intro) — для шапки на странице. */
export function deriveArticleLeadPlainText(
  content: ArticleContentPayload | { blocks: ArticleBlockMvp[] },
): string | null {
  const intro = content.blocks.find((b) => b.type === "intro");
  if (!intro || intro.type !== "intro") return null;
  const text = extractPlainTextFromHtml(intro.text);
  return text || null;
}

/** HTML лида (intro) с разметкой редактора — для шапки без потери bold/italic/br. */
export function deriveArticleLeadHtml(
  content: ArticleContentPayload | { blocks: ArticleBlockMvp[] },
): string | null {
  const intro = content.blocks.find((b) => b.type === "intro");
  if (!intro || intro.type !== "intro") return null;
  const html = articleBlockHtmlForPublic(intro.text, "intro");
  if (!extractPlainTextFromHtml(html).trim()) return null;
  return html;
}

/** Превью статьи: первые строки блока intro (лид). */
export function deriveArticleExcerptFromContent(
  content: ArticleContentPayload,
): string | null {
  const intro = content.blocks.find((b) => b.type === "intro");
  if (!intro || intro.type !== "intro") return null;

  const lines = extractPlainTextLinesFromHtml(intro.text);
  if (lines.length === 0) return null;

  let text = lines.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length > ARTICLE_LEAD_EXCERPT_MAX) {
    text = `${text.slice(0, ARTICLE_LEAD_EXCERPT_MAX - 1).trim()}…`;
  }
  return text;
}

export function newBlock(
  type: ArticleBlockMvp["type"],
  id: () => string = () => randomId(),
): ArticleBlockMvp {
  const bid = id();
  switch (type) {
    case "intro":
      return { id: bid, type: "intro", text: "" };
    case "text":
      return { id: bid, type: "text", text: "" };
    case "quote":
      return { id: bid, type: "quote", text: "" };
    case "heading":
      return { id: bid, type: "heading", level: 2, text: "" };
    case "image":
      return { id: bid, type: "image", mediaId: "", alt: "", caption: "" };
    case "gallery":
      return { id: bid, type: "gallery", mediaIds: [], caption: "" };
    case "activityCard":
      return { id: bid, type: "activityCard", entityType: "PLACE", entityId: "" };
    case "embed":
      return { id: bid, type: "embed", embedHtml: "", caption: "" };
    default: {
      const _x: never = type;
      return _x;
    }
  }
}
