import type { ContentStatus } from "@prisma/client";
import type { ArticleEditorSnapshot, ArticleSaveInput } from "@/lib/article/articleAdminTypes";
import {
  newBlock,
  type ArticleBlockEntityType,
  type ArticleContentPayload,
  type ArticleBlockMvp,
} from "@/lib/publications/articleMvp";
import { randomId } from "@/lib/utils/randomId";

/** Маркер в `Article.subtitle` — отличает Breaking news от обычной статьи. */
export const BREAKING_NEWS_SUBTITLE = "__breaking_news__";

export type BreakingNewsFormState = {
  title: string;
  slug: string;
  coverImageId: string;
  galleryIds: string[];
  bodyHtml: string;
  pricingHtml: string;
  linkedEntityType: ArticleBlockEntityType;
  linkedEntityId: string;
  status: ContentStatus;
  scheduledAtLocal: string;
  publishedAtLocal: string;
  seoTitle: string;
  seoDescription: string;
  seoCanonicalUrl: string;
  noindex: boolean;
  authorUserId: string | null;
};

export function emptyBreakingNewsContent(): ArticleContentPayload {
  return {
    version: 1,
    blocks: [newBlock("text"), newBlock("text")],
  };
}

/** Сборка блоков: два text (тело, цены), опционально activityCard и gallery. */
export function buildBreakingNewsContent(state: BreakingNewsFormState): ArticleContentPayload {
  const blocks: ArticleBlockMvp[] = [];
  blocks.push({ id: randomId(), type: "text", text: state.bodyHtml });
  blocks.push({ id: randomId(), type: "text", text: state.pricingHtml });
  if (state.linkedEntityId.trim()) {
    blocks.push({
      id: randomId(),
      type: "activityCard",
      entityType: state.linkedEntityType,
      entityId: state.linkedEntityId.trim(),
    });
  }
  if (state.galleryIds.length > 0) {
    blocks.push({
      id: randomId(),
      type: "gallery",
      mediaIds: state.galleryIds,
      caption: "",
    });
  }
  return { version: 1, blocks };
}

export function breakingNewsStateToArticleSaveInput(
  state: BreakingNewsFormState,
  opts: { publishedAtIso: string | null; scheduledAtIso: string | null },
): ArticleSaveInput {
  return {
    title: state.title.trim() || "Без названия",
    slug: state.slug.trim() || null,
    subtitle: BREAKING_NEWS_SUBTITLE,
    excerpt: null,
    content: buildBreakingNewsContent(state),
    coverImageId: state.coverImageId.trim() || null,
    authorLabel: null,
    authorUserId: state.authorUserId,
    cityContext: null,
    status: state.status,
    publishedAt: opts.publishedAtIso,
    scheduledAt: opts.scheduledAtIso,
    seoTitle: state.seoTitle.trim() || null,
    seoDescription: state.seoDescription.trim() || null,
    seoCanonicalUrl: state.seoCanonicalUrl.trim() || null,
    seoOgTitle: null,
    seoOgDescription: null,
    seoRobots: null,
    noindex: state.noindex,
  };
}

export function isBreakingNewsSnapshot(snapshot: ArticleEditorSnapshot): boolean {
  return snapshot.subtitle === BREAKING_NEWS_SUBTITLE;
}

export function parseBreakingNewsFromSnapshot(snapshot: ArticleEditorSnapshot): BreakingNewsFormState {
  const content = snapshot.content;
  const texts = content.blocks.filter((b): b is Extract<ArticleBlockMvp, { type: "text" }> => b.type === "text");
  const bodyHtml = texts[0]?.text ?? "";
  const pricingHtml = texts[1]?.text ?? "";
  const card = content.blocks.find((b): b is Extract<ArticleBlockMvp, { type: "activityCard" }> => b.type === "activityCard");
  const gallery = content.blocks.find((b): b is Extract<ArticleBlockMvp, { type: "gallery" }> => b.type === "gallery");

  return {
    title: snapshot.title === "Без названия" ? "" : snapshot.title,
    slug: snapshot.slug ?? "",
    coverImageId: snapshot.coverImageId ?? "",
    galleryIds: gallery?.mediaIds ?? [],
    bodyHtml,
    pricingHtml,
    linkedEntityType: card?.entityType ?? "PLACE",
    linkedEntityId: card?.entityId ?? "",
    status: snapshot.status,
    scheduledAtLocal: toLocalDatetimeValue(snapshot.scheduledAt),
    publishedAtLocal: toLocalDatetimeValue(snapshot.publishedAt),
    seoTitle: snapshot.seoTitle ?? "",
    seoDescription: snapshot.seoDescription ?? "",
    seoCanonicalUrl: snapshot.seoCanonicalUrl ?? "",
    noindex: snapshot.noindex,
    authorUserId: snapshot.authorUserId,
  };
}

function toLocalDatetimeValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalDatetimeValue(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
