"use client";

/**
 * BreakingNewsView — editorial Breaking News article page.
 *
 * Design: mamaGo 2.0 / News page.html (exported from Claude Design).
 * Palette: cream #F6F2EA · paper #FAF7F1 · ink #141210 · accent #E86A3A · breaking #D6342B
 * Fonts: NTSomic for UI and display · project body font · system mono
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { PublicationTagChips } from "@/components/article/PublicationTagChips";
import { MobileSmartBackButton } from "@/components/shared/MobileSmartBackButton";
import type { ArticleMvpResolvedBlock, PlaceCardExtra } from "@/lib/article/articleMvpRenderData";
import { articleBlockHtmlForEditor, articleBlockHtmlForPublic } from "@/lib/article/articleBlockHtml";
import { SaveHeart } from "@/features/save/SaveHeart";
import { ArticleDetailActions } from "@/components/article/ArticleDetailActions";
import { getCityHomeHref } from "@/lib/header/getCityHomeHref";
import { ArticleGallery } from "@/components/article/mvp/ArticleGallery";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: "#F6F2EA",
  paper: "#FAF7F1",
  ink: "#141210",
  ink2: "#3A332B",
  ink3: "rgba(20,18,16,.55)",
  line: "rgba(20,18,16,.10)",
  line2: "rgba(20,18,16,.18)",
  accent: "#E86A3A",
  accentDeep: "#C24E22",
  accentSoft: "#FFE8DC",
  breaking: "#D6342B",
  white: "#FAF7F1",
} as const;

const FONT_DISPLAY = "var(--font-sans), ui-sans-serif, system-ui, sans-serif";
const FONT_MONO = "ui-monospace, 'JetBrains Mono', monospace";

// ─── Shared micro-styles ──────────────────────────────────────────────────────

const capsStyle: React.CSSProperties = {
  fontFamily: FONT_MONO,
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: ".14em",
  color: C.ink3,
};

function SectionKicker({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
      <span style={{ ...capsStyle, color: C.ink }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: C.line }} />
    </div>
  );
}

// ─── Reading progress ─────────────────────────────────────────────────────────

function ReadingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = (h.scrollHeight - h.clientHeight) || 1;
      setP(Math.min(1, Math.max(0, h.scrollTop / max)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 90, pointerEvents: "none" }}>
      <div style={{ height: "100%", width: `${p * 100}%`, background: C.accent, transition: "width .1s linear" }} />
    </div>
  );
}

// ─── Marquee ticker ───────────────────────────────────────────────────────────

const MARQUEE_ITEM_GAP = 20;

function MarqueeDot() {
  return (
    <span
      aria-hidden
      style={{
        width: 5,
        height: 5,
        borderRadius: 99,
        background: "#fff",
        opacity: 0.65,
        flexShrink: 0,
      }}
    />
  );
}

function Marquee({ items }: { items: string[] }) {
  const half = Array.from({ length: 15 }, () => items).flat();
  const row = [...half, ...half];
  return (
    <div style={{ background: C.breaking, color: "#fff", overflow: "hidden" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: MARQUEE_ITEM_GAP,
        whiteSpace: "nowrap",
        width: "max-content",
        animation: "bn-marquee 18s linear infinite",
        padding: "9px 0",
        fontFamily: FONT_MONO,
        fontSize: 11,
        letterSpacing: ".08em",
        textTransform: "uppercase",
      }}>
        {row.map((t, i) => (
          <span key={i} style={{ display: "contents" }}>
            <MarqueeDot />
            <span style={{ opacity: 0.9 }}>{t}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Published-at chip ────────────────────────────────────────────────────────

function useRelativeTime(publishedAt: Date | null) {
  const [label, setLabel] = useState(() => computeLabel(publishedAt));

  useEffect(() => {
    if (!publishedAt) return;
    const diff = Date.now() - publishedAt.getTime();
    const interval = diff < 86_400_000 ? 60_000 : 0;
    if (!interval) return;
    const id = setInterval(() => setLabel(computeLabel(publishedAt)), interval);
    return () => clearInterval(id);
  }, [publishedAt]);

  return label;
}

function pluralDay(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "дней";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}

function computeLabel(publishedAt: Date | null): string {
  if (!publishedAt) return "";
  const diff = Date.now() - publishedAt.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (diff < 60_000) return "только что";
  if (diff < 3_600_000) return `${minutes}м назад`;
  if (diff < 86_400_000) {
    const m = minutes % 60;
    return m > 0 ? `${hours}ч ${m}м назад` : `${hours}ч назад`;
  }
  if (days <= 5) return `${days} ${pluralDay(days)} назад`;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    .format(publishedAt)
    .replace(/ г\.$/, "");
}

function PublishedAtChip({ publishedAt }: { publishedAt: Date | null }) {
  const label = useRelativeTime(publishedAt);
  if (!label) return null;
  return <span style={capsStyle}>{label}</span>;
}


// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

const BREADCRUMB_HREFS: Record<string, string> = {
  "Главная": "/",
  "Журнал": "/blog",
};

function Breadcrumbs({ items }: { items: string[] }) {
  return (
    <div style={{
      maxWidth: 1200, margin: "0 auto", padding: "28px 28px 16px",
      display: "flex", gap: 8, alignItems: "center",
      color: C.ink3, fontSize: 13, overflowX: "auto", whiteSpace: "nowrap",
    }}>
      {items.map((t, i) => {
        const isLast = i === items.length - 1;
        const href = BREADCRUMB_HREFS[t];
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {i > 0 && <span style={{ opacity: .45, fontSize: 11 }}>→</span>}
            {!isLast && href ? (
              <Link href={href} style={{ color: "inherit", textDecoration: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.ink; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ""; }}
              >{t}</Link>
            ) : (
              <span style={{ color: isLast ? C.ink : "inherit" }}>{t}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ─── Hero section ─────────────────────────────────────────────────────────────

function NewsHero({
  articleId,
  title,
  excerpt,
  publishedAt,
  author,
  editHref,
}: {
  articleId: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  author: { displayName: string | null; avatarUrl: string | null } | null;
  editHref?: string;
}) {
  const formattedDate = publishedAt
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(publishedAt).replace(/ г\.$/, "")
    : null;

  const authorName = author?.displayName ?? "Редакция mamaGo";
  const authorInitial = authorName.charAt(0).toUpperCase();

  return (
    <section style={{ padding: "4px 0 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {/* Meta row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              color: C.breaking,
              fontFamily: FONT_MONO, letterSpacing: ".14em", textTransform: "uppercase",
              fontSize: 11, fontWeight: 500,
            }}>
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: C.breaking,
                  flexShrink: 0,
                  animation: "bn-pulse 1.6s ease-out infinite",
                }}
              />
              Breaking News
            </span>
            <span style={{ ...capsStyle, color: C.ink2 }}>Минск</span>
            <span style={capsStyle}>·</span>
            <PublishedAtChip publishedAt={publishedAt} />
            <span style={capsStyle}>· 5 мин чтения</span>
            {editHref ? (
              <>
                <span style={capsStyle}>·</span>
                <Link
                  href={editHref}
                  style={{
                    ...capsStyle,
                    color: C.ink,
                    textDecoration: "underline",
                    textUnderlineOffset: "4px",
                  }}
                >
                  Редактировать
                </Link>
              </>
            ) : null}
          </div>

          {/* H1 */}
          <h1 style={{
            fontFamily: FONT_DISPLAY, fontWeight: 400,
            fontSize: "clamp(40px, 5.4vw, 78px)", lineHeight: .98,
            letterSpacing: "-.025em", margin: "0 0 22px", color: C.ink,
          }}>
            {title}
          </h1>

          {/* Dek */}
          {excerpt && (
            <p style={{
              maxWidth: 620, color: C.ink2, fontSize: 19, lineHeight: 1.5,
              marginBottom: 28, marginTop: 0,
            }}>
              {excerpt}
            </p>
          )}

          {/* Author bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap",
            paddingTop: 18, borderTop: `1px solid ${C.line}`,
            color: C.ink3, fontSize: 13,
          }}>
            {/* Author */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {author?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={author.avatarUrl} alt={authorName}
                  style={{ width: 35, height: 35, borderRadius: 99, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <span style={{
                  width: 35, height: 35, borderRadius: 99,
                  background: C.accentSoft, color: C.accentDeep,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 600, flexShrink: 0,
                }}>{authorInitial}</span>
              )}
              <div>
                <div style={{ color: C.ink, fontSize: 14, fontWeight: 600, letterSpacing: "-.01em" }}>{authorName}</div>
              </div>
            </div>

            <span style={{ flex: 1 }} />

            {/* Save + Share */}
            <ArticleDetailActions
              articleId={articleId}
              title={title}
              href={typeof window !== "undefined" ? window.location.pathname : ""}
              source="breaking-news-detail"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ urls, startIndex, onClose }: { urls: string[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const total = urls.length;
  const prev = useCallback(() => setIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setIdx((i) => (i + 1) % total), [total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose, prev, next]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.92)", padding: 16, backdropFilter: "blur(4px)" }}
      role="dialog" aria-modal="true"
    >
      <button onClick={onClose} aria-label="Закрыть"
        style={{ position: "absolute", top: 16, right: 16, zIndex: 10, borderRadius: 999, background: "rgba(255,255,255,.12)", padding: 8, color: "#fff", border: 0, cursor: "pointer", display: "flex" }}>
        <X size={20} />
      </button>
      {total > 1 && (
        <button onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Предыдущее"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 10, borderRadius: 999, background: "rgba(255,255,255,.12)", padding: 10, color: "#fff", border: 0, cursor: "pointer", display: "flex" }}>
          <ChevronLeft size={24} />
        </button>
      )}
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", maxWidth: "92vw", maxHeight: "90vh", display: "flex", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={idx} src={urls[idx]} alt={`Фото ${idx + 1} из ${total}`}
          style={{ maxHeight: "88vh", maxWidth: "88vw", borderRadius: 16, objectFit: "contain" }} />
        {total > 1 && (
          <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", borderRadius: 999, background: "rgba(0,0,0,.5)", padding: "4px 14px", fontSize: 12, color: "#fff", fontFamily: FONT_MONO }}>
            {idx + 1} / {total}
          </div>
        )}
      </div>
      {total > 1 && (
        <button onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Следующее"
          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", zIndex: 10, borderRadius: 999, background: "rgba(255,255,255,.12)", padding: 10, color: "#fff", border: 0, cursor: "pointer", display: "flex" }}>
          <ChevronRight size={24} />
        </button>
      )}
    </div>
  );
}

// ─── Editorial gallery ────────────────────────────────────────────────────────

// Kept temporarily as the previous Breaking News gallery implementation; the
// shared ArticleGallery now owns rendering so saved presentation modes are honored.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HeroGallery({ urls, title }: { urls: string[]; title: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (urls.length === 0) return null;

  const show = urls.slice(0, 3);
  const extra = Math.max(0, urls.length - 3);

  return (
    <>
      <section style={{ padding: "0 0 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px" }}>
          <div style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: `repeat(${show.length}, 1fr)`,
            gridTemplateRows: "380px",
            borderRadius: 18,
            overflow: "hidden",
          }}>
            {show.map((url, i) => {
              const isLast = i === show.length - 1 && extra > 0;
              return (
                <div
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  style={{ position: "relative", overflow: "hidden", cursor: "pointer", background: C.bg }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`${title} — фото ${i + 1}`}
                    style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", transition: "transform 1.2s cubic-bezier(.2,.7,.2,1)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1.04)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLImageElement).style.transform = ""; }}
                  />
                  {isLast ? (
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "rgba(20,18,16,.52)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                    }}>
                      <span style={{ fontFamily: FONT_DISPLAY, fontSize: 52, lineHeight: 1, color: "#fff", fontWeight: 400 }}>
                        +{extra}
                      </span>
                      <span style={{ ...capsStyle, color: "rgba(250,247,241,.8)", fontSize: 10 }}>смотреть все</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {lightboxIndex !== null && (
        <Lightbox urls={urls} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  );
}

// ─── Article body ─────────────────────────────────────────────────────────────

type ContentBlock = Extract<ArticleMvpResolvedBlock, { type: "text" }> | Extract<ArticleMvpResolvedBlock, { type: "quote" }>;

function ArticleBody({ blocks }: { blocks: ArticleMvpResolvedBlock[] }) {
  const contentBlocks = blocks.filter((b): b is ContentBlock => b.type === "text" || b.type === "quote");

  if (contentBlocks.length === 0) return null;

  return (
    <section style={{ padding: "28px 0 12px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {contentBlocks.map((block, i) => {
            const textBlockIndex =
              block.type === "text"
                ? contentBlocks.slice(0, i + 1).filter((item) => item.type === "text").length - 1
                : -1;
            const isPricingTextBlock = block.type === "text" && textBlockIndex === 1;
            if (block.type === "text" && isPricingTextBlock && !block.text.trim()) {
              return null;
            }

            return (
            <div key={block.id} style={{ marginBottom: i < contentBlocks.length - 1 ? 48 : 0 }}>
              {block.type === "text" && (
                <>
                  {isPricingTextBlock ? <SectionKicker label="Сколько стоит" /> : null}
                  <div
                    className="bn-body"
                    style={{ color: C.ink, fontFamily: "var(--font-serif)", fontSize: 20, lineHeight: 1.7 }}
                    dangerouslySetInnerHTML={{ __html: articleBlockHtmlForPublic(block.text, "text") }}
                  />
                </>
              )}
              {block.type === "quote" && (
                <blockquote style={{ display: "flex", gap: 20, margin: 0, padding: 0 }}>
                  <div style={{ width: 3, flexShrink: 0, alignSelf: "stretch", borderRadius: 99, background: C.accent }} />
                  <div style={{ minWidth: 0, flex: 1, paddingBlock: 4 }}>
                    <div
                      className="bn-body"
                      style={{ fontFamily: "var(--font-serif)", fontSize: 22, lineHeight: 1.6, color: C.ink, fontStyle: "italic" }}
                      dangerouslySetInnerHTML={{ __html: articleBlockHtmlForEditor(block.text, "quote") }}
                    />
                    {(block.attribution || block.authorRole) && (
                      <footer style={{ marginTop: 14, ...capsStyle, fontSize: 11, color: C.ink3 }}>
                        {block.attribution && <span>— {block.attribution}</span>}
                        {block.attribution && block.authorRole && <span style={{ margin: "0 8px" }}>·</span>}
                        {block.authorRole && <span>{block.authorRole}</span>}
                      </footer>
                    )}
                  </div>
                </blockquote>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Price section ────────────────────────────────────────────────────────────

function PriceSection({ placeExtra }: { placeExtra: PlaceCardExtra }) {
  const { priceData, priceUpdatedAt } = placeExtra;
  const items = priceData.items;
  if (items.length === 0 && !priceData.note?.trim()) return null;

  const dateLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(priceUpdatedAt))
    .replace(/ г\.$/, "");

  return (
    <section style={{ padding: "40px 0 0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <SectionKicker label="Сколько стоит" />

          {/* Rows */}
          <div style={{ borderTop: `1px solid ${C.line}` }}>
            {items.map((item, i) => (
              <div key={item.id} style={{
                display: "flex", alignItems: "baseline", gap: 16,
                padding: "16px 0",
                borderBottom: `1px solid ${C.line}`,
              }}>
                <span style={{ ...capsStyle, width: 20, flexShrink: 0, color: C.ink3 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ flex: 1, fontSize: 15, color: C.ink, lineHeight: 1.4 }}>{item.label}</span>
                <span style={{
                  fontFamily: FONT_DISPLAY, fontSize: "clamp(28px, 3.5vw, 40px)",
                  fontWeight: 400, lineHeight: 1, letterSpacing: "-.02em",
                  color: C.ink, whiteSpace: "nowrap",
                }}>
                  {item.price}
                </span>
                {item.unit && (
                  <span style={{ ...capsStyle, color: C.ink3, fontSize: 10, whiteSpace: "nowrap" }}>
                    {item.unit}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 0 0", flexWrap: "wrap", gap: 8,
          }}>
            <span style={{ ...capsStyle, color: C.ink3, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: C.ink3 }} />
              цены актуальны на {dateLabel}
            </span>
            {priceData.note?.trim() && (
              <span style={{ ...capsStyle, color: C.ink3 }}>{priceData.note.trim()}</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Place / Event / Offer card ───────────────────────────────────────────────

type ActivityCard = {
  href: string;
  title: string;
  meta?: string;
  placeExtra?: PlaceCardExtra;
};

function EntitySaveHeart({
  entityType,
  entityId,
  title,
}: {
  entityType: string;
  entityId: string;
  title: string;
}) {
  if (entityType === "OFFER") {
    return (
      <SaveHeart
        activityId={entityId}
        offerId={entityId}
        activityTitle={title}
        source="breaking-news-offer"
        className="h-10 w-10 bg-white shadow-[0_1px_2px_rgba(20,18,16,0.08)]"
        iconClassName="h-5 w-5"
      />
    );
  }

  if (entityType === "EVENT") {
    return (
      <SaveHeart
        activityId={entityId}
        activityTitle={title}
        source="breaking-news-event"
        className="h-10 w-10 bg-white shadow-[0_1px_2px_rgba(20,18,16,0.08)]"
        iconClassName="h-5 w-5"
      />
    );
  }

  return null;
}

function formatPlaceLocationLine(address: string | null | undefined, cityName: string | null | undefined) {
  const city = cityName?.trim();
  const parts = (address ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const lower = part.toLowerCase();
      return !lower.includes("область") && !lower.includes("район") && lower !== "беларусь";
    });

  const streetParts = parts.filter((part) => {
    if (!city) return true;
    return part.toLowerCase() !== city.toLowerCase();
  });

  if (city && streetParts.length > 0) {
    return `г. ${city}, ${streetParts.join(", ")}`;
  }
  if (city) {
    return `г. ${city}`;
  }
  return streetParts.join(", ") || null;
}

function LinkedEntityCard({
  card,
  entityType,
  entityId,
}: {
  card: ActivityCard;
  entityType: string;
  entityId: string;
}) {
  const typeLabel = entityType === "EVENT" ? "Событие" : entityType === "OFFER" ? "Предложение" : "Место";
  const extra = card.placeExtra;

  const coordsLabel = extra?.lat && extra?.lng
    ? `${extra.lat.toFixed(3)}° N · ${extra.lng.toFixed(3)}° E`
    : null;

  const workingHoursLabel = extra?.openingHoursSummary?.trim() || null;

  const allTags = extra ? [...(extra.ageTags ?? []), ...(extra.activityTypes ?? [])] : [];

  const locationLine = formatPlaceLocationLine(extra?.address, extra?.cityName);

  return (
    <section style={{ padding: "40px 0 12px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <SectionKicker label="О чём речь" />

          <div
            className="bn-place-card"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 260px) 1fr",
              gap: 0,
              background: C.paper,
              border: `1px solid ${C.line}`,
              borderRadius: 22,
              overflow: "hidden",
            }}
          >
            {/* Map panel */}
            <div style={{ position: "relative", background: "linear-gradient(180deg, #DCF0E4 0%, #BED9CB 100%)", minHeight: 240 }}>
              {/* Subtle grid lines */}
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: `
                  linear-gradient(rgba(20,18,16,.06) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(20,18,16,.06) 1px, transparent 1px)
                `,
                backgroundSize: "32px 32px",
              }} />
              {/* Coordinates */}
              {coordsLabel && (
                <span style={{
                  position: "absolute", top: 14, left: 14,
                  fontFamily: FONT_MONO, fontSize: 10, color: "rgba(20,18,16,.5)",
                  letterSpacing: ".1em",
                }}>
                  {coordsLabel}
                </span>
              )}
              {/* Pin */}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 99,
                  background: C.accent, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                  boxShadow: `0 0 0 12px rgba(232,106,58,.18), 0 12px 28px rgba(20,18,16,.18)`,
                }}>
                  📍
                </div>
              </div>
            </div>

            {/* Info panel */}
            <div style={{ padding: "22px 24px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Type + heart */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={capsStyle}>{typeLabel}</span>
                <EntitySaveHeart entityType={entityType} entityId={entityId} title={card.title} />
              </div>

              {/* Title */}
              <a href={card.href} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{
                  fontFamily: FONT_DISPLAY, fontWeight: 400,
                  fontSize: "clamp(22px, 2.8vw, 32px)", lineHeight: 1.08, letterSpacing: "-.02em",
                  color: C.ink, textDecoration: "underline", textUnderlineOffset: 5, textDecorationThickness: 1,
                }}>
                  {card.title}
                </div>
              </a>

              {/* Address */}
              {locationLine && (
                <span style={{ fontSize: 13, color: C.ink2, lineHeight: 1.4 }}>{locationLine}</span>
              )}

              {/* Working hours */}
              {workingHoursLabel && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontFamily: FONT_MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase",
                  color: C.accentDeep,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: C.accentDeep }} />
                  {workingHoursLabel}
                </span>
              )}

              {/* Tags */}
              {allTags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {allTags.slice(0, 5).map((tag) => (
                    <span key={tag} style={{
                      display: "inline-flex", alignItems: "center", height: 28, padding: "0 12px",
                      borderRadius: 999, border: `1px solid ${C.line2}`, fontSize: 12, color: C.ink2,
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* CTA buttons */}
              <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                <a
                  href={card.href}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    height: 44, padding: "0 18px", borderRadius: 999,
                    background: C.accent, color: "#fff", fontSize: 14, fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Смотреть место <span aria-hidden>→</span>
                </a>
                {extra?.lat && extra?.lng && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${extra.lat},${extra.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center",
                      height: 44, padding: "0 18px", borderRadius: 999,
                      border: `1.5px solid ${C.line2}`, color: C.ink2, fontSize: 14,
                      textDecoration: "none", background: "transparent",
                    }}
                  >
                    Маршрут
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Related articles ─────────────────────────────────────────────────────────

const RELATED_TONES = [
  "linear-gradient(160deg, #E6DBC8, #C9BCA0)",
  "linear-gradient(160deg, #F2C8A7, #E89460)",
  "linear-gradient(160deg, #CDE3D6, #9CC1AC)",
];

type RelatedArticle = {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  publishedAt: Date | null;
  heroUrl: string | null;
};

function RelatedSection({ items }: { items: RelatedArticle[] }) {
  if (items.length === 0) return null;
  return (
    <section style={{ padding: "52px 0 28px", borderTop: `1px solid ${C.line}`, marginTop: 44 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px" }}>
        <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 220 }}>
            <span style={capsStyle}>Дальше читать</span>
            <span style={{ flex: 1, height: 1, background: C.line }} />
          </div>
          <Link href="/blog" style={{ fontSize: 14, color: C.ink2, textDecoration: "underline", textUnderlineOffset: 4 }}>
            Все материалы →
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {items.map((it, i) => (
            <Link
              key={it.id}
              href={it.slug ? `/blog/${it.slug}` : "/blog"}
              style={{
                display: "flex", flexDirection: "column", gap: 14, cursor: "pointer",
                padding: "18px 18px 20px",
                border: `1px solid ${C.line}`,
                borderRadius: 18,
                background: C.paper,
                textDecoration: "none", color: "inherit",
                transition: "transform .2s, box-shadow .2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 40px -20px rgba(20,18,16,.18)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "";
                (e.currentTarget as HTMLElement).style.boxShadow = "";
              }}
            >
              {/* Cover */}
              <div style={{ aspectRatio: "3/2", borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
                {it.heroUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.heroUrl} alt={it.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: RELATED_TONES[i % RELATED_TONES.length] }} />
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ ...capsStyle, color: C.accentDeep }}>● Новость</span>
                {it.publishedAt && (
                  <span style={capsStyle}>
                    {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(it.publishedAt)}
                  </span>
                )}
              </div>

              <div style={{
                fontFamily: FONT_DISPLAY, fontWeight: 400,
                fontSize: 22, lineHeight: 1.12, letterSpacing: "-.015em",
                color: C.ink,
              }}>
                {it.title}
              </div>

              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.ink3, marginTop: "auto", letterSpacing: ".08em", textTransform: "uppercase" }}>
                5 мин чтения →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Keyframes injector ───────────────────────────────────────────────────────

function GlobalStyles() {
  return (
    <style>{`
      .bn-body p { margin-top: 0; margin-bottom: 1.4em; }
      .bn-body p:last-child { margin-bottom: 0; }
      /* Как в редакторе: переносы внутри одного <p> выглядят отдельными строками */
      .bn-body p br { display: block; margin-bottom: 0.65em; }
      .bn-body p br:last-child { margin-bottom: 0; }
      .bn-body ul, .bn-body ol { margin-top: 0; margin-bottom: 1.4em; padding-left: 1.5em; }
      .bn-body ul { list-style-type: disc; }
      .bn-body ol { list-style-type: decimal; }
      .bn-body li { display: list-item; margin-bottom: 0.4em; }
      .bn-body li:last-child { margin-bottom: 0; }
      .bn-body li > p { margin-bottom: 0.4em; }
      .bn-body li > p:last-child { margin-bottom: 0; }
      .bn-body strong, .bn-body b { font-weight: 600; }
      .bn-body em, .bn-body i { font-style: italic; }
      .bn-body a { color: ${C.accent}; text-decoration: underline; text-underline-offset: 3px; }
      @keyframes bn-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      @keyframes bn-blink { 0%, 60% { opacity: 1; } 80% { opacity: .25; } 100% { opacity: 1; } }
      @keyframes bn-pulse { 0% { box-shadow: 0 0 0 0 rgba(214,52,43,.55); } 70% { box-shadow: 0 0 0 12px rgba(214,52,43,0); } 100% { box-shadow: 0 0 0 0 rgba(214,52,43,0); } }



      /* Place card responsive */
      @media (max-width: 640px) {
        .bn-place-card { grid-template-columns: 1fr !important; }
        .bn-gallery-grid { grid-template-columns: 1fr 1fr !important; grid-template-rows: 200px 130px 130px !important; }
        .bn-related-grid { grid-template-columns: 1fr !important; }
      }
      @media (max-width: 900px) {
        .bn-related-grid { grid-template-columns: 1fr 1fr !important; }
        .bn-gallery-grid { grid-template-columns: 1fr 1fr 1fr !important; grid-template-rows: 220px 160px !important; }
      }
    `}</style>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface BreakingNewsViewProps {
  articleId: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  blocks: ArticleMvpResolvedBlock[];
  author: { displayName: string | null; avatarUrl: string | null } | null;
  tags?: Array<{ slug: string; title: string }>;
  related: RelatedArticle[];
  editHref?: string;
  draftWatermark?: boolean;
  citySlug?: string | null;
}

export function BreakingNewsView({
  articleId,
  title,
  excerpt,
  publishedAt,
  blocks,
  author,
  tags = [],
  related,
  editHref,
  draftWatermark,
  citySlug,
}: BreakingNewsViewProps) {
  const cityHomeHref = getCityHomeHref(citySlug);

  const galleryBlock = blocks.find((b): b is Extract<ArticleMvpResolvedBlock, { type: "gallery" }> => b.type === "gallery");

  // Extract activity card block.
  const activityBlock = blocks.find((b): b is Extract<ArticleMvpResolvedBlock, { type: "activityCard" }> => b.type === "activityCard");

  // Build marquee items from article context.
  const marqueeItems = ["BREAKING NEWS"];

  const breadcrumbs = ["Главная", "Журнал", title];

  return (
    <div style={{ background: "#fff", color: C.ink, minHeight: "100vh", position: "relative" }}>
      <GlobalStyles />

      {/* Grain texture overlay */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1000,
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .35 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        opacity: .055, mixBlendMode: "multiply",
      }} aria-hidden />

      {/* Reading progress bar */}
      <ReadingProgress />

      {/* Breaking ticker */}
      <Marquee items={marqueeItems} />

      {draftWatermark && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 28px 0" }}>
          <div style={{ borderRadius: 10, border: "1px solid #fde68a", background: "#fffbeb", padding: "10px 16px", fontSize: 13, color: "#92400e" }}>
            Черновик / предпросмотр — так видят только редакторы
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1200px] px-4 pt-4 sm:px-6 lg:px-8">
        <MobileSmartBackButton fallbackHref={cityHomeHref} />
      </div>

      <Breadcrumbs items={breadcrumbs} />
      <NewsHero
        articleId={articleId}
        title={title}
        excerpt={excerpt}
        publishedAt={publishedAt}
        author={author}
        editHref={editHref}
      />
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-[760px] pb-6">
          <PublicationTagChips tags={tags} citySlug={citySlug} />
        </div>
      </div>
      {galleryBlock ? (
        <div className="mx-auto w-full max-w-[760px] px-4 sm:px-6">
          <ArticleGallery images={galleryBlock.images} presentation={galleryBlock.presentation} caption={galleryBlock.caption} />
        </div>
      ) : null}
      <ArticleBody blocks={blocks} />

      {activityBlock?.card && activityBlock.card.kind === "basic" && activityBlock.card.placeExtra && (
        <PriceSection placeExtra={activityBlock.card.placeExtra} />
      )}

      {activityBlock?.card && (
        <LinkedEntityCard
          card={activityBlock.card}
          entityType={activityBlock.entityType}
          entityId={activityBlock.entityId}
        />
      )}

      <RelatedSection items={related} />
    </div>
  );
}
