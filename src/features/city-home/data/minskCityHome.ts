import type { BreakingNewsItem } from "@/features/city-home/components/BreakingNewsStrip";

export const MINSK_BREAKING_NEWS: BreakingNewsItem[] = [];

export type JournalPreviewArticle = {
  slug: string;
  title: string;
  subtitle: string | null;
  category: string;
  readTime: number;
};

export const MINSK_JOURNAL_PREVIEW: JournalPreviewArticle[] = [];
