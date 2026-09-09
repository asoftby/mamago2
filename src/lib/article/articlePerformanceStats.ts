import type { PublicationStatsPeriod } from "@/lib/publication-stats/period";
import type {
  ArticlePerformanceAction,
  ArticlePerformanceTrackedBlockType,
} from "@/lib/article/articlePerformanceAnalytics";

export type ArticlePerformanceBlockStats = {
  blockId: string;
  blockType: ArticlePerformanceTrackedBlockType;
  impressions: number;
  actions: Partial<Record<ArticlePerformanceAction, number>>;
  actionItems: Record<string, number>;
};

export type ArticlePerformanceSubjectStats = {
  subjectId: string;
  title: string;
  source: "MANUAL" | "CATALOG" | "LEGACY";
  catalogEntityType?: string;
  catalogEntityId?: string;
  impressions: number;
  targetActions: number;
  ctr: number | null;
  blocks: ArticlePerformanceBlockStats[];
};

export type ArticlePerformanceStatsPayload = {
  kind: "article-performance";
  article: {
    id: string;
    title: string;
    slug: string | null;
    status: string;
    publishedAt: string | null;
    updatedAt: string;
  };
  period: PublicationStatsPeriod;
  statsUpdatedAt: string;
  metrics: {
    /** Qualified browser-visible article views (not SSR/prefetch renders). */
    views: number;
    uniqueReaders: number;
    read75: number;
    read75Rate: number | null;
    completed: number;
    completionRate: number | null;
    saves: number;
    shares: number;
    ratings: number;
    positiveRatingRate: number | null;
    targetActions: number;
  };
  shares: {
    telegram: number;
    whatsapp: number;
    copy: number;
    native: number;
  };
  ratings: {
    like: number;
    neutral: number;
    dislike: number;
    total: number;
    positiveRate: number | null;
  };
  subjects: ArticlePerformanceSubjectStats[];
};

export function isArticlePerformanceStatsPayload(value: unknown): value is ArticlePerformanceStatsPayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { kind?: unknown }).kind === "article-performance",
  );
}
