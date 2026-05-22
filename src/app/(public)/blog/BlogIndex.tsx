"use client";

import Link from "next/link";
import { useState } from "react";
import type { CityHomeJournalArticle } from "@/server/article/listCityHomeArticles";

const TONES = [
  "from-[#F2C8A7] to-[#E89460]",
  "from-[#CDE3D6] to-[#9CC1AC]",
  "from-[#F6D567] to-[#E8B935]",
  "from-[#E6DBC8] to-[#C9BCA0]",
];

function fmtDate(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

const FILTERS = [
  { key: "all", label: "Все" },
  { key: "Статья", label: "Статьи" },
  { key: "Новость", label: "Новости" },
];

export function BlogIndex({ articles }: { articles: CityHomeJournalArticle[] }) {
  const [active, setActive] = useState("all");

  const filtered =
    active === "all" ? articles : articles.filter((a) => a.category === active);

  const [featured, ...rest] = filtered;

  return (
    <>
      {/* ── Hero ── */}
      <section className="border-b border-border">
        <div className="site-wrap px-6 sm:px-7 py-10 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-8 items-end">
          <div>
            <div className="flex items-center gap-3 mb-5 text-[11px] font-mono uppercase tracking-[.14em] text-muted-foreground">
              <span className="text-primary">●</span>
              <span>Журнал</span>
              <span className="opacity-40">·</span>
              <span>{articles.length} материалов</span>
            </div>

            <h1
              className="font-serif m-0 leading-[.94] tracking-[-0.03em]"
              style={{ fontSize: "clamp(56px, 9vw, 124px)" }}
            >
              Идеи
              <br />
              <span className="italic text-primary">и маршруты.</span>
            </h1>

            <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground max-w-[520px]">
              Вдохновение для семейных прогулок, событий и открытий — в одной редакторской подборке.
            </p>
          </div>

          {articles.length > 0 && (
            <div className="flex flex-col gap-1.5 items-end text-right p-4 bg-card border border-border rounded-2xl min-w-[200px] self-end sm:mb-1">
              <span className="text-[10px] font-mono uppercase tracking-[.14em] text-primary">
                ● На этой неделе
              </span>
              <div
                className="font-serif leading-tight tracking-tight"
                style={{ fontSize: "clamp(24px, 3vw, 32px)" }}
              >
                {articles.length} новых
              </div>
              <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-[.08em]">
                ●{" "}
                {articles.filter((a) => a.isBreakingNews).length > 0
                  ? `${articles.filter((a) => a.isBreakingNews).length} breaking · `
                  : ""}
                {articles.filter((a) => !a.isBreakingNews).length} статей
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Filters ── */}
      <section className="border-b border-border">
        <div className="site-wrap px-6 sm:px-7 py-3.5 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-[.14em] text-muted-foreground mr-2">
            Раздел
          </span>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setActive(f.key)}
              className={[
                "inline-flex items-center h-8 px-3 rounded-full border text-[13px] transition-all cursor-pointer",
                active === f.key
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-foreground border-border hover:border-foreground",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Content ── */}
      <div className="site-wrap px-6 sm:px-7 pb-16">
        {filtered.length === 0 ? (
          <p className="py-12 text-sm text-muted-foreground">
            В журнале пока нет материалов в этой категории.
          </p>
        ) : (
          <>
            {featured && <FeaturedArticle article={featured} />}

            {rest.length > 0 && (
              <div>
                <div className="flex items-center gap-4 my-6">
                  <span className="text-[10px] font-mono uppercase tracking-[.14em] text-muted-foreground shrink-0">
                    все материалы
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                    {rest.length} из {articles.length}
                  </span>
                </div>
                {rest.map((a, i) => (
                  <ArticleRow key={a.slug} article={a} idx={i + 1} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <NewsletterCTA />
    </>
  );
}

function FeaturedArticle({ article }: { article: CityHomeJournalArticle }) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12 py-12 border-b border-border"
    >
      {/* Image */}
      <div
        className={`relative overflow-hidden rounded-[18px] bg-gradient-to-br ${TONES[0]} aspect-[5/4]`}
      >
        {article.coverImageUrl ? (
          <img
            src={article.coverImageUrl}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] font-mono uppercase tracking-[.12em] text-black/40">
            обложка
          </div>
        )}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm text-[11px] font-semibold font-mono uppercase tracking-[.14em] text-foreground/70">
          ★ Главное
        </span>
      </div>

      {/* Text */}
      <div className="flex flex-col gap-4 justify-center">
        <div className="flex items-center gap-3 flex-wrap">
          {article.isBreakingNews ? (
            <BreakingPill />
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold font-mono uppercase tracking-[.12em]">
              ● {article.category}
            </span>
          )}
          {article.publishedAt && (
            <span className="text-[11px] font-mono uppercase tracking-[.12em] text-muted-foreground">
              {fmtDate(article.publishedAt)}
            </span>
          )}
          <span className="text-[11px] font-mono text-muted-foreground">
            {article.readTime} мин
          </span>
        </div>

        <h2
          className="font-serif m-0 leading-[1] tracking-[-0.025em] group-hover:text-primary transition-colors"
          style={{ fontSize: "clamp(32px, 4.2vw, 58px)" }}
        >
          {article.title}
          {article.subtitle && (
            <>
              <br />
              <span className="italic text-primary">{article.subtitle}</span>
            </>
          )}
        </h2>

        <div className="mt-2">
          <span className="inline-flex items-center gap-2 h-12 px-5 rounded-full bg-foreground text-background text-sm font-semibold">
            Читать →
          </span>
        </div>
      </div>
    </Link>
  );
}

function ArticleRow({ article, idx }: { article: CityHomeJournalArticle; idx: number }) {
  const tone = TONES[idx % TONES.length];

  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group grid grid-cols-1 sm:grid-cols-[200px_1fr_180px] gap-4 sm:gap-9 py-8 border-t border-border last:border-b items-center transition-[padding] duration-200 hover:sm:pl-2"
    >
      {/* Meta */}
      <div className="flex sm:flex-col gap-3 sm:gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {article.isBreakingNews && <BreakingPill />}
          <span className="text-[11px] font-mono uppercase tracking-[.12em] text-primary">
            ● {article.category}
          </span>
        </div>
        {article.publishedAt && (
          <span className="text-[13px] text-foreground font-medium tracking-[-.005em]">
            {fmtDate(article.publishedAt)}
          </span>
        )}
        <span className="text-[11px] font-mono text-muted-foreground">
          {article.readTime} мин
        </span>
        <span className="hidden sm:block text-[10px] font-mono uppercase tracking-[.14em] text-muted-foreground/30 mt-1">
          № {String(idx + 1).padStart(2, "0")}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3">
        <h3
          className="font-serif m-0 leading-[1.02] tracking-[-0.02em] text-foreground group-hover:text-primary transition-colors"
          style={{ fontSize: "clamp(22px, 2.6vw, 36px)" }}
        >
          {article.title}
          {article.subtitle && (
            <> <span className="italic text-primary">{article.subtitle}</span></>
          )}
        </h3>
      </div>

      {/* Image */}
      <div
        className={`hidden sm:block relative overflow-hidden rounded-2xl bg-gradient-to-br ${tone} aspect-[4/3]`}
      >
        {article.coverImageUrl && (
          <img
            src={article.coverImageUrl}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <span className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-sm text-foreground transition-transform duration-300 group-hover:translate-x-1.5 group-hover:text-primary">
          →
        </span>
        {!article.coverImageUrl && (
          <span className="absolute bottom-2 left-2.5 right-2.5 flex justify-between">
            <span className="text-[10px] font-mono uppercase tracking-[.12em] text-black/35">обложка</span>
            <span className="text-[10px] font-mono text-black/25">{String(idx + 1).padStart(2, "0")}</span>
          </span>
        )}
      </div>
    </Link>
  );
}

function BreakingPill() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-mono uppercase tracking-[.12em]">
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      Breaking
    </span>
  );
}

function NewsletterCTA() {
  return (
    <section className="py-24 border-t border-border">
      <div className="site-wrap px-6 sm:px-7 text-center">
        <span className="block text-[10px] font-mono uppercase tracking-[.14em] text-muted-foreground mb-5">
          ● подпишитесь на еженедельную рассылку
        </span>
        <h2
          className="font-serif m-0 leading-[.95] tracking-[-0.025em] max-w-4xl mx-auto"
          style={{ fontSize: "clamp(44px, 7vw, 104px)" }}
        >
          Новые истории
          <br />
          <span className="italic text-primary">каждую пятницу</span>.
        </h2>
        <p className="text-[17px] text-muted-foreground max-w-[440px] mx-auto mt-5 mb-7 leading-relaxed">
          Один редакционный дайджест в неделю: 5 идей, что почитать и куда сходить с ребёнком.
        </p>
        <form
          className="inline-flex gap-2 bg-card border border-border rounded-full p-1.5 max-w-[420px] w-full"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            placeholder="ваш e-mail"
            className="flex-1 bg-transparent border-0 outline-none px-4 text-sm text-foreground placeholder:text-muted-foreground min-w-0"
          />
          <button
            type="submit"
            className="h-11 px-5 rounded-full bg-primary text-white text-sm font-semibold whitespace-nowrap hover:opacity-90 transition-opacity"
          >
            Подписаться →
          </button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">● 12 000 родителей уже читают</p>
      </div>
    </section>
  );
}
