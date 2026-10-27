"use client";

import Link from "next/link";
import type { CityHomeJournalArticle } from "@/server/article/listCityHomeArticles";
import { ArticleSaveHeart, type ArticleSaveStatus } from "@/features/save/ArticleSaveHeart";
import { formatJournalPublishedDate } from "@/lib/article/formatJournalPublishedDate";
import { formatCollectionMeta, formatJournalRelativeTime } from "@/lib/journal/journalCardMeta";
import { cn } from "@/lib/utils";
import { JournalBadge, journalTypeBadgeVariant } from "./JournalBadge";

const TONES = [
  "from-[#F2C8A7] to-[#E89460]",
  "from-[#CDE3D6] to-[#9CC1AC]",
  "from-[#F6D567] to-[#E8B935]",
  "from-[#E6DBC8] to-[#C9BCA0]",
];

function Cover({ article, tone, className }: { article: CityHomeJournalArticle; tone: number; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-gradient-to-br", TONES[tone % TONES.length], className)}>
      {article.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={article.coverImageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
    </div>
  );
}

/** Мета карточки по типу: статья — время чтения, подборка — «10 мест/событий», новость — дата. */
export function journalCardMeta(article: CityHomeJournalArticle, now?: Date): string {
  if (article.publicationType === "COLLECTION") {
    return formatCollectionMeta(article.collectionItemCount, article.collectionEventCount);
  }
  if (article.publicationType === "BREAKING_NEWS") {
    return article.publishedAt ? formatJournalRelativeTime(article.publishedAt, now) : "";
  }
  return `${article.readTime} мин чтения`;
}

function SaveOverlay({ article, saveStatus, source }: { article: CityHomeJournalArticle; saveStatus?: ArticleSaveStatus; source: string }) {
  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-10">
      <ArticleSaveHeart
        articleId={article.id}
        articleTitle={article.title}
        coverImageUrl={article.coverImageUrl}
        initialStatus={saveStatus}
        skipOwnFetch
        source={source}
        className="h-11 w-11 bg-white/90 shadow-sm backdrop-blur-[4px] sm:h-9 sm:w-9"
        iconClassName="h-5 w-5 sm:h-4 sm:w-4"
      />
    </div>
  );
}

/** «Главное»: одна большая карточка с бейджем «★ Главное» поверх обложки. */
export function JournalMainCard({ article, saveStatus }: { article: CityHomeJournalArticle; saveStatus?: ArticleSaveStatus }) {
  const typeBadge = journalTypeBadgeVariant(article.publicationType);
  return (
    <div className="relative">
      <Link href={article.href} className="group grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-center sm:gap-12">
        <div className="relative">
          <Cover article={article} tone={0} className="aspect-[4/3] rounded-[18px] sm:aspect-[5/4]" />
          <JournalBadge variant="main" className="absolute left-3 top-3" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {article.category ? (
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[.12em] text-brand-ink">
                {article.category.name}
              </span>
            ) : null}
            {typeBadge ? <JournalBadge variant={typeBadge} /> : null}
          </div>
          <h2 className="m-0 font-heading text-[26px] leading-[1.1] tracking-[-0.025em] transition-colors group-hover:text-primary sm:text-[36px]">
            {article.title}
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {[article.geographyLabel, journalCardMeta(article)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </Link>
      <div className="pointer-events-none absolute inset-0 grid grid-cols-1 sm:grid-cols-2 sm:gap-12">
        <div className="relative aspect-[4/3] sm:aspect-[5/4]">
          <SaveOverlay article={article} saveStatus={saveStatus} source="journal-main" />
        </div>
      </div>
    </div>
  );
}

/** Компактная карточка новости: тёмный бейдж «НОВОСТЬ · 2 ч». */
export function JournalNewsCard({ article }: { article: CityHomeJournalArticle }) {
  const relative = article.publishedAt ? formatJournalRelativeTime(article.publishedAt) : null;
  return (
    <Link
      href={article.href}
      className="group flex h-full min-h-11 flex-col gap-3 rounded-2xl border border-border bg-background p-3 transition-colors hover:border-foreground/30"
    >
      <Cover article={article} tone={1} className="aspect-[16/10] rounded-xl" />
      <JournalBadge variant="news" detail={relative} className="self-start" />
      <h3 className="m-0 line-clamp-3 text-[15px] font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
        {article.title}
      </h3>
    </Link>
  );
}

/** Высокая карточка подборки для карусели: бейдж «ПОДБОРКА · 10» поверх обложки. */
export function JournalCollectionCard({ article, tone = 0 }: { article: CityHomeJournalArticle; tone?: number }) {
  return (
    <Link href={article.href} className="group flex h-full flex-col gap-3">
      <div className="relative">
        <Cover article={article} tone={tone} className="aspect-[3/4] rounded-[18px]" />
        <JournalBadge
          variant="collection"
          detail={article.collectionItemCount > 0 ? String(article.collectionItemCount) : null}
          className="absolute left-3 top-3"
        />
      </div>
      <h3 className="m-0 line-clamp-3 font-heading text-[19px] leading-[1.15] tracking-[-0.015em] text-foreground transition-colors group-hover:text-primary">
        {article.title}
      </h3>
      <p className="text-[13px] text-muted-foreground">{journalCardMeta(article)}</p>
    </Link>
  );
}

/** Строка ленты «Свежие материалы»: миниатюра, рубрика + бейдж типа (у статьи нет), заголовок, мета. */
export function JournalFeedRow({
  article,
  index,
  saveStatus,
}: {
  article: CityHomeJournalArticle;
  index: number;
  saveStatus?: ArticleSaveStatus;
}) {
  const typeBadge = journalTypeBadgeVariant(article.publicationType);
  const date = article.publishedAt ? formatJournalPublishedDate(article.publishedAt) : null;
  return (
    <div className="relative">
      <Link
        href={article.href}
        className="group grid min-h-11 grid-cols-[96px_1fr] items-center gap-4 border-t border-border py-4 sm:grid-cols-[180px_1fr] sm:gap-8 sm:py-6"
      >
        <Cover article={article} tone={index} className="aspect-square rounded-xl sm:aspect-[4/3] sm:rounded-2xl" />
        <div className="flex min-w-0 flex-col gap-2 pr-12 sm:pr-14">
          <div className="flex flex-wrap items-center gap-2">
            {article.category ? (
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[.12em] text-brand-ink">
                {article.category.name}
              </span>
            ) : null}
            {typeBadge ? <JournalBadge variant={typeBadge} /> : null}
          </div>
          <h3 className="m-0 line-clamp-3 font-heading text-[19px] leading-[1.15] tracking-[-0.015em] text-foreground transition-colors group-hover:text-primary sm:text-[26px]">
            {article.title}
          </h3>
          <p className="text-[12px] text-muted-foreground sm:text-[13px]">
            {[article.geographyLabel, date, journalCardMeta(article)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </Link>
      <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2">
        <div className="pointer-events-auto">
          <ArticleSaveHeart
            articleId={article.id}
            articleTitle={article.title}
            coverImageUrl={article.coverImageUrl}
            initialStatus={saveStatus}
            skipOwnFetch
            source="journal-feed-row"
            className="h-11 w-11 bg-transparent"
            iconClassName="h-5 w-5"
          />
        </div>
      </div>
    </div>
  );
}
