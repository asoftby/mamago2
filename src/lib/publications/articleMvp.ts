import { z } from "zod";
import {
  extractPlainTextFromHtml,
  extractPlainTextLinesFromHtml,
} from "@/lib/richtext/utils";
import { articleBlockHtmlForPublic } from "@/lib/article/articleBlockHtml";
import { randomId } from "@/lib/utils/randomId";
import { SharedContactsDataSchema } from "@/domain/contacts/structuredContacts";
import { SharedPriceDataSchema } from "@/domain/pricing/structuredPrice";
import { SharedOpeningHoursDataSchema, OPENING_HOURS_DAYS } from "@/domain/opening-hours/structuredOpeningHours";

/** Версия формата `Article.contentJson` */
export const ARTICLE_CONTENT_VERSION = 1 as const;

export const ArticleBlockEntityTypeSchema = z.enum(["EVENT", "PLACE", "OFFER", "ROUTE", "ARTICLE"]);
export type ArticleBlockEntityType = z.infer<typeof ArticleBlockEntityTypeSchema>;

export const DEFAULT_ARTICLE_PLACE_SECTIONS = {
  image: true,
  description: true,
  address: true,
  contacts: true,
  openingHours: true,
  price: true,
  events: false,
  offers: false,
  cta: true,
} as const;

export const ArticlePlaceSectionsSchema = z.object({
  image: z.boolean(),
  description: z.boolean(),
  address: z.boolean(),
  contacts: z.boolean(),
  openingHours: z.boolean(),
  price: z.boolean(),
  events: z.boolean(),
  offers: z.boolean(),
  cta: z.boolean(),
});
export type ArticlePlaceSections = z.infer<typeof ArticlePlaceSectionsSchema>;

export const ArticleGalleryPresentationSchema = z.enum(["carousel", "mosaic", "sequential"]);
export type ArticleGalleryPresentation = z.infer<typeof ArticleGalleryPresentationSchema>;
export const LEGACY_ARTICLE_GALLERY_PRESENTATION: ArticleGalleryPresentation = "mosaic";

const base = z.object({ id: z.string().min(1) });
const ArticlePriceDataSchema = SharedPriceDataSchema.superRefine((value, ctx) => {
  value.items.forEach((item, index) => {
    if (!item.label.trim() || !item.price.trim() || !item.unit.trim()) {
      ctx.addIssue({ code: "custom", path: ["items", index], message: "Price items require a label, price and unit" });
    }
  });
});

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
    presentation: ArticleGalleryPresentationSchema.optional(),
    caption: z.string().optional(),
  }),
  base.extend({
    type: z.literal("activityCard"),
    entityType: ArticleBlockEntityTypeSchema,
    entityId: z.string(),
    placeSections: ArticlePlaceSectionsSchema.optional(),
  }),
  base.extend({
    type: z.literal("embed"),
    embedHtml: z.string(),
    caption: z.string().optional(),
  }),
  base.extend({ type: z.literal("contacts"), data: SharedContactsDataSchema }),
  base.extend({ type: z.literal("price"), data: ArticlePriceDataSchema }),
  base.extend({ type: z.literal("openingHours"), data: SharedOpeningHoursDataSchema }),
]).superRefine((block, ctx) => {
  if (block.type === "activityCard" && block.entityType !== "PLACE" && block.placeSections) {
    ctx.addIssue({ code: "custom", path: ["placeSections"], message: "Place sections are only valid for PLACE cards" });
  }
});

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

/** Removes only completely blank Article price draft rows before API serialization. */
export function prepareArticleContentForSave(payload: ArticleContentPayload): ArticleContentPayload {
  return {
    ...payload,
    blocks: payload.blocks.map((block) => {
      if (block.type !== "price") return block;
      return {
        ...block,
        data: {
          ...block.data,
          currency: block.data.currency.trim(),
          note: block.data.note.trim(),
          items: block.data.items.flatMap((item) => {
            const label = item.label.trim();
            const price = item.price.trim();
            const description = item.description?.trim();
            const oldPrice = item.oldPrice?.trim();
            if (!label && !price && !description && !oldPrice) return [];
            return [{ ...item, label, price, unit: item.unit.trim(), ...(description ? { description } : {}), ...(oldPrice ? { oldPrice } : {}) }];
          }),
        },
      };
    }),
  };
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

/** Где именно внутри статьи используется конкретный MediaAsset — для «Фото этой статьи» в picker'е. */
export const ArticleMediaUsageKindSchema = z.enum(["cover", "seo", "image-block", "gallery-block"]);
export type ArticleMediaUsageKind = z.infer<typeof ArticleMediaUsageKindSchema>;

export type ArticleMediaUsageEntry = { mediaId: string; usage: ArticleMediaUsageKind[] };

/**
 * Все MediaAsset.id, на которые ссылается статья (обложка, legacy SEO-картинка,
 * image/gallery блоки), с дедупликацией и списком мест использования на каждый id.
 * Owner-agnostic: намеренно не трогает `uploadedById` — задача picker'а показать
 * «Фото этой статьи» независимо от того, кому исторически принадлежит файл
 * (важно для migrated/legacy статей, где uploadedById=ADMIN).
 * Порядок: id встречи первого usage (cover → seo → блоки по порядку).
 * Единый source of truth и для сервера (API), и для клиента (draft-статья без id) — см. п.16 тикета.
 */
export function extractArticleMediaUsage(input: {
  coverImageId?: string | null;
  seoImageId?: string | null;
  blocks?: ArticleBlockMvp[] | null;
}): ArticleMediaUsageEntry[] {
  const order: string[] = [];
  const usageByMedia = new Map<string, Set<ArticleMediaUsageKind>>();

  const add = (mediaId: string | null | undefined, kind: ArticleMediaUsageKind) => {
    const id = mediaId?.trim();
    if (!id) return;
    if (!usageByMedia.has(id)) {
      usageByMedia.set(id, new Set());
      order.push(id);
    }
    usageByMedia.get(id)!.add(kind);
  };

  add(input.coverImageId, "cover");
  add(input.seoImageId, "seo");
  for (const block of input.blocks ?? []) {
    if (block.type === "image") add(block.mediaId, "image-block");
    if (block.type === "gallery") {
      for (const mediaId of block.mediaIds) add(mediaId, "gallery-block");
    }
  }

  return order.map((mediaId) => ({ mediaId, usage: [...usageByMedia.get(mediaId)!] }));
}

/** Уникальный список media id, используемых статьёй — без usage-детализации. */
export function extractArticleMediaIds(input: {
  coverImageId?: string | null;
  seoImageId?: string | null;
  blocks?: ArticleBlockMvp[] | null;
}): string[] {
  return extractArticleMediaUsage(input).map((entry) => entry.mediaId);
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
      return { id: bid, type: "gallery", mediaIds: [], presentation: "carousel", caption: "" };
    case "activityCard":
      return {
        id: bid,
        type: "activityCard",
        entityType: "PLACE",
        entityId: "",
        placeSections: { ...DEFAULT_ARTICLE_PLACE_SECTIONS },
      };
    case "embed":
      return { id: bid, type: "embed", embedHtml: "", caption: "" };
    case "contacts":
      return { id: bid, type: "contacts", data: { phones: [], socials: [] } };
    case "price":
      return { id: bid, type: "price", data: { mode: "UNKNOWN", currency: "BYN", min: null, max: null, items: [], note: "" } };
    case "openingHours":
      return {
        id: bid,
        type: "openingHours",
        data: {
          mode: "WEEKLY",
          timezone: "Europe/Minsk",
          rules: OPENING_HOURS_DAYS.map((dayOfWeek) => ({ dayOfWeek, isOpen: false, allDay: false, intervals: [] })),
          exceptions: [],
        },
      };
    default: {
      const _x: never = type;
      return _x;
    }
  }
}
