/**
 * Доменные типы публикаций (mamaGo 2.0).
 * Готовы к переносу в Prisma: Publication + enum-поля.
 */

export const PublicationType = {
  ARTICLE: "ARTICLE",
  NEWS: "NEWS",
  COLLECTION: "COLLECTION",
} as const;
export type PublicationType = (typeof PublicationType)[keyof typeof PublicationType];

export const PublicationStatus = {
  DRAFT: "DRAFT",
  PENDING: "PENDING",
  PUBLISHED: "PUBLISHED",
  REJECTED: "REJECTED",
  SCHEDULED: "SCHEDULED",
  ARCHIVED: "ARCHIVED",
} as const;
export type PublicationStatus = (typeof PublicationStatus)[keyof typeof PublicationStatus];

/** Таб «Все» — без фильтра по типу контента */
export const PublicationTabFilter = {
  ALL: "ALL",
  ARTICLE: "ARTICLE",
  NEWS: "NEWS",
  COLLECTION: "COLLECTION",
} as const;
export type PublicationTabFilter =
  (typeof PublicationTabFilter)[keyof typeof PublicationTabFilter];

export type PublicationListRow = {
  id: string;
  title: string;
  /** Публичный slug статьи (для ссылок /blog/[slug]); для других типов позже */
  slug: string | null;
  type: PublicationType;
  status: PublicationStatus;
  authorLabel: string;
  /** Связь с User; для фильтра «как в редакторе» */
  authorUserId: string | null;
  cityOrContext: string;
  publishedAt: string | null;
  views: number;
  updatedAt: string;
  /** Денормализовано из Article для списка */
  hasCover: boolean;
  hasSlug: boolean;
  hasBlocks: boolean;
};

/** Блоки статьи — расширяемый union */
export const ArticleBlockType = {
  TITLE: "title",
  INTRO: "intro",
  TEXT: "text",
  QUOTE: "quote",
  IMAGE: "image",
  GALLERY: "gallery",
  HTML: "html",
  ACTIVITY_CARD: "activityCard",
  DYNAMIC_ACTIVITY_FEED: "dynamicActivityFeed",
} as const;
export type ArticleBlockType = (typeof ArticleBlockType)[keyof typeof ArticleBlockType];

export type ArticleBlockBase = {
  id: string;
  type: ArticleBlockType;
};

export type DynamicActivityFeedMode = "static" | "dynamic";

export type DynamicActivityRules = {
  cityId?: string;
  entityType?: "EVENT" | "PLACE" | "OFFER" | "ROUTE";
  categoryIds?: string[];
  tagIds?: string[];
  occasionIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  indoorOutdoor?: "indoor" | "outdoor" | "any";
  audienceAgeMinMonths?: number;
  audienceAgeMaxMonths?: number;
  sortPreset?: "relevance" | "newest" | "popular";
};

export type DynamicActivityFeedBlock = ArticleBlockBase & {
  type: typeof ArticleBlockType.DYNAMIC_ACTIVITY_FEED;
  mode: DynamicActivityFeedMode;
  /** Режим static: id сущностей вручную */
  pinnedActivityIds?: string[];
  /** Режим dynamic */
  rules?: DynamicActivityRules;
};

export type ArticleBlock =
  | (ArticleBlockBase & { type: typeof ArticleBlockType.TITLE; text: string })
  | (ArticleBlockBase & { type: typeof ArticleBlockType.INTRO; text: string })
  | (ArticleBlockBase & { type: typeof ArticleBlockType.TEXT; markdown: string })
  | (ArticleBlockBase & { type: typeof ArticleBlockType.QUOTE; text: string; attribution?: string })
  | (ArticleBlockBase & {
      type: typeof ArticleBlockType.IMAGE;
      mediaId?: string;
      alt?: string;
      caption?: string;
    })
  | (ArticleBlockBase & {
      type: typeof ArticleBlockType.GALLERY;
      mediaIds: string[];
    })
  | (ArticleBlockBase & { type: typeof ArticleBlockType.HTML; html: string })
  | (ArticleBlockBase & {
      type: typeof ArticleBlockType.ACTIVITY_CARD;
      activityId: string;
    })
  | DynamicActivityFeedBlock;
