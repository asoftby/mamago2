import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArticleHeader } from "@/components/article/ArticleHeader";
import { ArticleContent } from "@/components/article/ArticleContent";
import { ArticleEventCardBlock } from "@/components/article/blocks/ArticleEventCardBlock";
import { ArticleOfferCardBlock } from "@/components/article/blocks/ArticleOfferCardBlock";
import { ArticleOfferEmbed } from "@/components/article/blocks/ArticleOfferEmbed";
import { ArticleEmbedBlock } from "@/components/article/blocks/ArticleEmbedBlock";
import { ArticlePlaceEmbed } from "@/components/article/blocks/ArticlePlaceEmbed";
import {
  deriveArticleLeadHtml,
  deriveArticleLeadPlainText,
  type ArticleBlockMvp,
} from "@/lib/publications/articleMvp";
import type { ArticleMvpResolvedBlock } from "@/lib/article/articleMvpRenderData";
import {
  articleHeadingAnchorId,
  buildArticleTocBranches,
  extractHeadingEntriesFromArticleBlocks,
  shouldShowArticleToc,
  type ArticleTocBranch,
} from "@/lib/article/articleHeadingAnchors";
import { ArticleReadingScrollPadding } from "@/components/article/mvp/ArticleReadingScrollPadding";
import { ArticleDetailActions } from "@/components/article/ArticleDetailActions";
import { articleBlockHtmlForEditor, articleBlockHtmlForPublic } from "@/lib/article/articleBlockHtml";
import { ArticleGallery } from "@/components/article/mvp/ArticleGallery";
import { MobileSmartBackButton } from "@/components/shared/MobileSmartBackButton";
import { PublicationTagChips } from "@/components/article/PublicationTagChips";
import { BREAKING_NEWS_SUBTITLE } from "@/lib/publications/breakingNewsArticle";
import { getCityHomeHref } from "@/lib/header/getCityHomeHref";
import { parseArticleEmbed } from "@/lib/article/articleEmbedSanitize";

/** Лёгкое оглавление: только текст и вложенный список для H3, без карточек и рамок. */
function ArticleInlineToc({ branches }: { branches: ArticleTocBranch[] }) {
  if (branches.length === 0) return null;
  return (
    <nav aria-label="Содержание статьи" className="not-prose max-w-[720px] mb-8 md:mb-10 font-sans">
      <p className="text-[20px] font-bold tracking-tight text-foreground mb-2.5">
        Содержание
      </p>
      <ul className="list-none m-0 p-0 space-y-0.5 text-[18px] font-normal leading-snug tracking-tight text-foreground/90">
        {branches.map((branch) => (
          <li key={branch.entry.id}>
            <a
              href={`#${branch.entry.anchorId}`}
              className="underline-offset-[3px] hover:underline decoration-foreground/25 hover:decoration-foreground/50"
            >
              {branch.entry.text}
            </a>
            {branch.children.length > 0 ? (
              <ul className="list-none m-0 mt-1.5 space-y-1 pl-4 border-l border-border/50">
                {branch.children.map((c) => (
                  <li key={c.id}>
                    <a
                      href={`#${c.anchorId}`}
                      className="text-muted-foreground underline-offset-[3px] hover:underline hover:text-foreground decoration-transparent hover:decoration-foreground/30"
                    >
                      {c.text}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ArticleMvpView({
  title,
  subtitle,
  excerpt,
  publishedAt,
  blocks,
  tags = [],
  editHref,
  draftWatermark,
  categoryLabel,
  citySlug,
  /** Доп. scroll-padding (напр. панель предпросмотра под хедером). */
  readingScrollPaddingExtraRem,
  /**
   * continuous: first = SSR-статья в ленте; continuation = подгруженная;
   * standalone = одиночная страница (по умолчанию).
   */
  continuousVariant = "standalone",
  articleAriaLabel,
  /** Переопределение ссылки «Все материалы» (городский журнал). */
  journalFooterHref,
  /** Save/Share actions — опущены на preview (нет id/href для реального сохранения). */
  articleId,
  articleHref,
  coverImageUrl,
}: {
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  publishedAt: Date | null | string;
  blocks: ArticleMvpResolvedBlock[];
  tags?: Array<{ slug: string; title: string }>;
  editHref?: string;
  draftWatermark?: boolean;
  categoryLabel?: string | null;
  citySlug?: string | null;
  readingScrollPaddingExtraRem?: number;
  continuousVariant?: "standalone" | "first" | "continuation";
  articleAriaLabel?: string;
  journalFooterHref?: string;
  articleId?: string;
  articleHref?: string;
  coverImageUrl?: string | null;
}) {
  // Detect Breaking News by the subtitle marker.
  const isBreakingNews = subtitle === BREAKING_NEWS_SUBTITLE;
  const headingEntries = extractHeadingEntriesFromArticleBlocks(blocks as ArticleBlockMvp[]);
  const showToc = shouldShowArticleToc(headingEntries);
  const tocBranches = showToc ? buildArticleTocBranches(headingEntries) : [];
  const firstBodyBlockIndex = blocks.findIndex((b) => b.type !== "intro");

  // Filter out the Breaking News marker — never show it as visible subtitle text.
  const subtitleTrim = (isBreakingNews ? "" : subtitle?.trim()) || "";
  const leadHtml = !isBreakingNews
    ? deriveArticleLeadHtml({ blocks: blocks as ArticleBlockMvp[] })
    : null;
  const leadPlain =
    deriveArticleLeadPlainText({ blocks: blocks as ArticleBlockMvp[] }) || "";
  const excerptTrim = excerpt?.trim() || "";
  const cityHomeHref = getCityHomeHref(citySlug);
  const journalHref = citySlug?.trim()
    ? `/${citySlug.trim()}/blog`
    : "/blog";
  /** Лид в шапке: editorial subtitle (plain) → intro HTML → excerpt plain */
  const headerDekHtml = !subtitleTrim ? leadHtml : null;
  const headerDekPlain =
    subtitleTrim || (!headerDekHtml ? excerptTrim || leadPlain : "") || "";

  const isContinuation = continuousVariant === "continuation";
  const showChromeBack = continuousVariant !== "continuation";
  const showJournalFooter = continuousVariant === "standalone";
  const footerHref = journalFooterHref?.trim() || journalHref;

  return (
    <div className={cn(continuousVariant === "standalone" && "min-h-screen bg-white")}>
      <article
        className={cn(
          "max-w-3xl mx-auto px-4 sm:px-6 scroll-smooth",
          isContinuation ? "pt-2 md:pt-4 pb-6 md:pb-10" : "py-10 md:py-16",
        )}
        aria-label={articleAriaLabel?.trim() || title}
      >
      <ArticleReadingScrollPadding extraTopRem={readingScrollPaddingExtraRem ?? 0} />
      {showChromeBack ? (
        <div className="mb-4 md:mb-0">
          <MobileSmartBackButton fallbackHref={cityHomeHref} />
        </div>
      ) : null}
      {draftWatermark ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Черновик / предпросмотр — так видят только редакторы
        </div>
      ) : null}
      <ArticleHeader
        title={title}
        subtitle={headerDekPlain || undefined}
        subtitleHtml={headerDekHtml || undefined}
        journalLabel="Обзоры и статьи"
        journalHref={journalHref}
        category={categoryLabel?.trim() || undefined}
        categoryHref={categoryLabel?.trim() ? journalHref : undefined}
        readTime={5}
        publishedAt={publishedAt ?? undefined}
        editHref={editHref}
      />

      {articleId && articleHref ? (
        <ArticleDetailActions
          articleId={articleId}
          title={title}
          href={articleHref}
          coverImageUrl={coverImageUrl}
          source={`article-detail-${continuousVariant}`}
          className="mb-6 md:mb-8"
        />
      ) : null}

      <PublicationTagChips tags={tags} citySlug={citySlug} className="mb-6 md:mb-8" />

      <ArticleContent>
        {blocks.map((block, i) => {
          const tocBeforeBody =
            showToc && i === firstBodyBlockIndex ? (
              <ArticleInlineToc branches={tocBranches} />
            ) : null;

          // Лид показываем только в шапке (excerpt), в теле статьи не дублируем.
          if (block.type === "intro") {
            return null;
          }

          const body = (() => {
            if (block.type === "text") {
              const legacyEmbed = parseArticleEmbed(block.text);
              if (legacyEmbed?.provider === "youtube") {
                return <ArticleEmbedBlock value={block.text} />;
              }
              return (
                <div
                  className="font-serif leading-[1.75] md:leading-[1.8] text-foreground/95 mb-6 md:mb-7 last:mb-0 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ol]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-primary/40"
                  dangerouslySetInnerHTML={{
                    __html: articleBlockHtmlForPublic(block.text, "text"),
                  }}
                />
              );
            }
            if (block.type === "quote") {
              return (
                <blockquote className="not-prose flex gap-4 my-8 md:my-10">
                  <div className="w-[3px] shrink-0 self-stretch rounded-full bg-primary" />
                  <div className="min-w-0 flex-1 py-1">
                    <div
                      className="text-xl leading-relaxed font-serif [&_em]:italic [&_i]:italic [&_p]:mb-3 [&_p:last-child]:mb-0"
                      dangerouslySetInnerHTML={{
                        __html: articleBlockHtmlForEditor(block.text, "quote"),
                      }}
                    />
                    {(block.attribution || block.authorRole) ? (
                      <footer className="mt-4 text-sm font-normal text-muted-foreground font-sans">
                        {block.attribution && <span>— {block.attribution}</span>}
                        {block.attribution && block.authorRole && <span className="mx-1.5">·</span>}
                        {block.authorRole && <span>{block.authorRole}</span>}
                      </footer>
                    ) : null}
                  </div>
                </blockquote>
              );
            }
            if (block.type === "heading") {
              const Tag = block.level === 2 ? "h2" : "h3";
              const cls =
                block.level === 2
                  ? "not-prose font-serif text-2xl md:text-[1.75rem] font-bold tracking-tight text-foreground mt-10 md:mt-12 mb-4 scroll-mt-28 md:scroll-mt-32"
                  : "not-prose font-serif text-xl md:text-[1.35rem] font-semibold tracking-tight text-foreground mt-8 md:mt-10 mb-3 scroll-mt-28 md:scroll-mt-32";
              return (
                <Tag id={articleHeadingAnchorId(block.id)} className={cls}>
                  {block.text}
                </Tag>
              );
            }
            if (block.type === "image") {
              return (
                <figure className="not-prose my-8 md:my-10">
                  {block.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={block.imageUrl}
                      alt={block.alt || title}
                      className="w-full rounded-xl border border-border/60 shadow-sm"
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                      Изображение не найдено (mediaId)
                    </div>
                  )}
                  {block.caption ? (
                    <figcaption className="mt-3 text-sm text-muted-foreground text-center px-1">
                      {block.caption}
                    </figcaption>
                  ) : null}
                </figure>
              );
            }
            if (block.type === "gallery") {
              return (
                <ArticleGallery images={block.images} presentation={block.presentation} caption={block.caption} />
              );
            }
            if (block.type === "embed") {
              return <ArticleEmbedBlock value={block.embedHtml} caption={block.caption} />;
            }
            if (block.type === "activityCard") {
              const c = block.card;
              if (block.entityType === "PLACE") {
                // A missing place-embed card is expected steady state (place
                // not public, or nothing live in any of its tabs) — the block
                // must render nothing at all, not an error message.
                if (!c || c.kind !== "place-embed") return null;
                return <ArticlePlaceEmbed card={c} />;
              }
              if (!c) {
                return <p className="text-sm text-muted-foreground my-6">Карточка: сущность не найдена</p>;
              }
              if (block.entityType === "EVENT" && c.kind === "basic") {
                return (
                  <ArticleEventCardBlock
                    title={c.title}
                    href={c.href}
                    dateLabel={c.meta ?? ""}
                    location=""
                    ageLabel=""
                    badge=""
                  />
                );
              }
              if (c.kind === "offer-embed") {
                return <ArticleOfferEmbed card={c} />;
              }
              if (c.kind === "place-embed") return null; // unreachable: PLACE handled above
              return <ArticleOfferCardBlock title={c.title} href={c.href} image={c.imageUrl ?? undefined} />;
            }
            return null;
          })();

          return (
            <Fragment key={block.id}>
              {tocBeforeBody}
              {body}
            </Fragment>
          );
        })}
      </ArticleContent>

      {showJournalFooter ? (
        <footer className="mt-14 md:mt-16 pt-8 border-t border-border/60 text-sm text-muted-foreground">
          <Link href={footerHref} className="text-primary hover:underline underline-offset-2">
            ← Все материалы
          </Link>
        </footer>
      ) : null}
      </article>
    </div>
  );
}
