import type { BreakingNewsItem } from "@/features/city-home/components/BreakingNewsStrip";

/** Редакторские заметки / новости города (пока статично; без данных блок скрывается) */
export const MINSK_BREAKING_NEWS: BreakingNewsItem[] = [
  {
    id: "n1",
    title: "Самая безопасная игровая в Минске: обзор площадок для малышей",
    href: "/blog/demo-premium-article",
    imageUrl:
      "https://images.unsplash.com/photo-1545558014-8692077e9b5c?q=80&w=800&auto=format&fit=crop",
    relativeTime: "18 часов назад",
  },
  {
    id: "n2",
    title: "Выставка птиц в Троицком предместье",
    href: "/minsk/kuda",
    imageUrl:
      "https://images.unsplash.com/photo-1444464666168-e49d077b8a7e?q=80&w=800&auto=format&fit=crop",
    relativeTime: "3 дня назад",
  },
  {
    id: "n3",
    title: "Палка. Новый выставочный проект для семей с детьми",
    href: "/blog/demo-premium-article",
    imageUrl:
      "https://images.unsplash.com/photo-1518998053901-5348d3961a04?q=80&w=800&auto=format&fit=crop",
    relativeTime: "1 неделя назад",
  },
  {
    id: "n4",
    title: "Самая изысканная весенняя фотозона в ботаническом саду",
    href: "/minsk/kuda",
    imageUrl:
      "https://images.unsplash.com/photo-1490750967868-88aa4486c946?q=80&w=800&auto=format&fit=crop",
    relativeTime: "2 недели назад",
  },
];

export type JournalPreviewArticle = {
  slug: string;
  title: string;
  subtitle: string | null;
  category: string;
  readTime: number;
};

export const MINSK_JOURNAL_PREVIEW: JournalPreviewArticle[] = [
  {
    slug: "demo-premium-article",
    title: "Как провести выходные с детьми в Минске: 7 идей",
    subtitle: "От парков до мастер-классов",
    category: "Идеи",
    readTime: 5,
  },
];
