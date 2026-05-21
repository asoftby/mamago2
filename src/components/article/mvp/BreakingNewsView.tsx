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
import type { ArticleMvpResolvedBlock } from "@/lib/article/articleMvpRenderData";
import { articleBlockHtmlForEditor } from "@/lib/article/articleBlockHtml";

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
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 90 }}>
      <div style={{ height: "100%", width: `${p * 100}%`, background: C.accent, transition: "width .1s linear" }} />
    </div>
  );
}

// ─── Marquee ticker ───────────────────────────────────────────────────────────

function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items, ...items];
  return (
    <div style={{ background: C.breaking, color: "#fff", overflow: "hidden" }}>
      <div style={{
        display: "flex", whiteSpace: "nowrap",
        animation: "bn-marquee 38s linear infinite",
        padding: "9px 0",
        fontFamily: FONT_MONO, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase",
      }}>
        {row.map((t, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 18, padding: "0 18px" }}>
            <span style={{ opacity: .9 }}>{t}</span>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: "#fff", opacity: .65 }} />
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Live clock ───────────────────────────────────────────────────────────────

function ClockChip() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      fontFamily: FONT_MONO, fontSize: 11, color: C.ink3,
      padding: "4px 10px", border: `1px solid ${C.line}`, borderRadius: 99,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: C.breaking, animation: "bn-pulse 1.8s ease-out infinite" }} />
      Минск · {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
    </span>
  );
}

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

function Breadcrumbs({ items }: { items: string[] }) {
  return (
    <div style={{
      maxWidth: 1320, margin: "0 auto", padding: "22px 28px 8px",
      display: "flex", gap: 8, alignItems: "center",
      color: C.ink3, fontSize: 13, overflowX: "auto", whiteSpace: "nowrap",
    }}>
      {items.map((t, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {i > 0 && <span style={{ opacity: .45, fontSize: 11 }}>→</span>}
          <span style={{ color: i === items.length - 1 ? C.ink : "inherit" }}>{t}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Hero section ─────────────────────────────────────────────────────────────

function NewsHero({
  title,
  excerpt,
  publishedAt,
  author,
}: {
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  author: { displayName: string | null; avatarUrl: string | null } | null;
}) {
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);

  const formattedDate = publishedAt
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(publishedAt)
    : null;

  const authorName = author?.displayName ?? "Редакция mamaGo";
  const authorInitial = authorName.charAt(0).toUpperCase();

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section style={{ padding: "4px 0 24px" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 28px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {/* Meta row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 26, padding: "0 10px", borderRadius: 999,
              background: C.breaking, color: "#fff",
              fontFamily: FONT_MONO, letterSpacing: ".14em", textTransform: "uppercase",
              fontSize: 11, fontWeight: 500,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: "#fff", animation: "bn-blink 1.6s ease-in-out infinite" }} />
              Breaking
            </span>
            <span style={capsStyle}>Журнал · Новость</span>
            <span style={{ ...capsStyle, color: C.ink2 }}>Минск</span>
            {formattedDate && <span style={capsStyle}>· {formattedDate}</span>}
            <span style={capsStyle}>· 5 мин чтения</span>
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
                  style={{ width: 30, height: 30, borderRadius: 99, objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <span style={{
                  width: 30, height: 30, borderRadius: 99,
                  background: C.accentSoft, color: C.accentDeep,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 600, flexShrink: 0,
                }}>{authorInitial}</span>
              )}
              <div>
                <div style={{ color: C.ink, fontSize: 14, fontWeight: 600, letterSpacing: "-.01em" }}>{authorName}</div>
                {formattedDate && (
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11, marginTop: 1, color: C.ink3 }}>
                    {formattedDate}
                  </div>
                )}
              </div>
            </div>

            <span style={{ flex: 1 }} />
            <ClockChip />

            {/* Like */}
            <button
              onClick={() => setLiked((l) => !l)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 32, padding: "0 12px", borderRadius: 999,
                border: `1px solid ${liked ? "transparent" : C.line2}`,
                background: liked ? C.accentSoft : "transparent",
                color: liked ? C.accentDeep : C.ink2,
                fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <span>{liked ? "♥" : "♡"}</span>
              {liked ? "В идеях" : "В идеи"}
            </button>

            {/* Share */}
            <button
              onClick={handleCopy}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 32, padding: "0 12px", borderRadius: 999,
                border: `1px solid ${C.line2}`, background: "transparent",
                color: C.ink2, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {copied ? "✓ Скопировано" : "↗ Поделиться"}
            </button>
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

function HeroGallery({ urls, title }: { urls: string[]; title: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (urls.length === 0) return null;

  const show = urls.slice(0, 4);  // max 4 real photos
  const extra = Math.max(0, urls.length - 4);

  return (
    <>
      <section style={{ padding: "0 0 24px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 28px" }}>
          {/* Editorial 2-row grid */}
          <div style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: show.length >= 3 ? "1.4fr 1fr 1fr" : show.length === 2 ? "1fr 1fr" : "1fr",
            gridTemplateRows: show.length >= 3 ? "280px 280px" : "320px",
            ...(show.length >= 3 ? {
              gridTemplateAreas: show.length >= 4
                ? '"a b c" "a d e"'
                : '"a b c"',
            } : {}),
            borderRadius: 18,
            overflow: "hidden",
          }}>
            {show.map((url, i) => (
              <div
                key={i}
                onClick={() => setLightboxIndex(i)}
                style={{
                  gridArea: ["a", "b", "c", "d"][i] as string | undefined,
                  position: "relative",
                  overflow: "hidden",
                  cursor: "pointer",
                  background: C.bg,
                  borderRadius: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${title} — фото ${i + 1}`}
                  style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", transition: "transform 1.2s cubic-bezier(.2,.7,.2,1)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLImageElement).style.transform = "scale(1.04)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLImageElement).style.transform = ""; }}
                />
                {/* Caption label */}
                <span style={{ position: "absolute", bottom: 12, left: 14, ...capsStyle, color: "rgba(250,247,241,.75)", fontSize: 10, pointerEvents: "none" }}>
                  0{i + 1} · фото
                </span>
              </div>
            ))}

            {/* Overflow "+N" card */}
            {(show.length >= 4 || extra > 0) && (
              <div
                onClick={() => setLightboxIndex(0)}
                style={{
                  gridArea: "e",
                  position: "relative",
                  background: C.ink,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 44, lineHeight: 1, color: C.white }}>
                    +{extra > 0 ? extra : urls.length}
                  </span>
                  <span style={{ ...capsStyle, color: "rgba(250,247,241,.55)", fontSize: 10 }}>смотреть все</span>
                </div>
                <span style={{ position: "absolute", bottom: 12, left: 14, ...capsStyle, color: "rgba(250,247,241,.5)", fontSize: 10 }}>
                  05+ · галерея
                </span>
              </div>
            )}
          </div>

          {/* Gallery label */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, color: C.ink3, fontSize: 12 }}>
            <span style={capsStyle}>{urls.length} {urls.length === 1 ? "фото" : "фото"} · галерея</span>
            <button
              onClick={() => setLightboxIndex(0)}
              style={{ ...capsStyle, background: "none", border: 0, cursor: "pointer", color: C.ink3 }}
            >
              ↗ открыть галерею
            </button>
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

function ArticleBody({ blocks }: { blocks: ArticleMvpResolvedBlock[] }) {
  const textBlocks = blocks.filter((b): b is Extract<ArticleMvpResolvedBlock, { type: "text" }> => b.type === "text");

  if (textBlocks.length === 0) return null;

  return (
    <section style={{ padding: "28px 0 12px" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 28px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {textBlocks.map((block, i) => {
            const isFirst = i === 0;
            return (
              <div
                key={block.id}
                style={{ marginBottom: i < textBlocks.length - 1 ? 48 : 0 }}
              >
                {/* Leading paragraph with drop-cap */}
                {isFirst ? (
                  <div
                    className="bn-lede"
                    style={{ fontSize: 22, lineHeight: 1.5, color: C.ink, letterSpacing: "-.01em", marginBottom: 24 }}
                    dangerouslySetInnerHTML={{ __html: articleBlockHtmlForEditor(block.text, "text") }}
                  />
                ) : (
                  <>
                    {/* Kicker for second block (pricing) */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, color: C.ink3 }}>
                      <span style={capsStyle}>Сколько стоит</span>
                      <span style={{ flex: 1, height: 1, background: C.line }} />
                    </div>
                    <div
                      style={{ fontSize: 19, lineHeight: 1.65, color: C.ink, letterSpacing: "-.003em" }}
                      dangerouslySetInnerHTML={{ __html: articleBlockHtmlForEditor(block.text, "text") }}
                    />
                  </>
                )}
              </div>
            );
          })}
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
};

function LinkedEntityCard({ card, entityType }: { card: ActivityCard; entityType: string }) {
  const [saved, setSaved] = useState(false);

  const typeLabel = entityType === "EVENT" ? "Событие" : entityType === "OFFER" ? "Предложение" : "Место";
  const typeIcon = entityType === "EVENT" ? "📅" : entityType === "OFFER" ? "🎁" : "📍";

  return (
    <section style={{ padding: "36px 0 12px" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 28px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {/* Kicker */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, color: C.ink3 }}>
            <span style={capsStyle}>О чём речь</span>
            <span style={{ flex: 1, height: 1, background: C.line }} />
          </div>

          <a
            href={card.href}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 280px) 1fr",
              gap: 0,
              background: C.paper,
              border: `1px solid ${C.line}`,
              borderRadius: 22,
              overflow: "hidden",
              textDecoration: "none",
              color: "inherit",
              transition: "transform .25s, box-shadow .25s, border-color .2s",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.transform = "translateY(-2px)";
              el.style.boxShadow = "0 28px 60px -30px rgba(20,18,16,.22)";
              el.style.borderColor = C.line2;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.transform = "";
              el.style.boxShadow = "";
              el.style.borderColor = C.line;
            }}
          >
            {/* Map/illustration side */}
            <div style={{ position: "relative", background: "linear-gradient(180deg, #E2EFE5, #C9DFD2)", minHeight: 220 }}>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 99,
                  background: C.accent, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                  boxShadow: `0 0 0 10px rgba(232,106,58,.22), 0 12px 28px rgba(20,18,16,.18)`,
                  animation: "bn-pulse 2.4s ease-out infinite",
                }}>
                  {typeIcon}
                </div>
              </div>
              <span style={{ position: "absolute", top: 14, left: 16, fontFamily: FONT_MONO, fontSize: 10, color: "rgba(20,18,16,.5)", letterSpacing: ".12em", textTransform: "uppercase" }}>
                mamaGo · {typeLabel}
              </span>
              {card.meta && (
                <span style={{ position: "absolute", bottom: 14, left: 16, fontFamily: FONT_MONO, fontSize: 10, color: "rgba(20,18,16,.5)", letterSpacing: ".12em", textTransform: "uppercase" }}>
                  {card.meta}
                </span>
              )}
            </div>

            {/* Info side */}
            <div style={{ padding: "24px 26px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={capsStyle}>{typeLabel}</span>
                <button
                  onClick={(e) => { e.preventDefault(); setSaved((s) => !s); }}
                  aria-label="Сохранить"
                  style={{
                    width: 36, height: 36, borderRadius: 99, cursor: "pointer",
                    border: `1px solid ${saved ? "transparent" : C.line2}`,
                    background: saved ? C.accentSoft : "transparent",
                    color: saved ? C.accentDeep : C.ink2,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  }}
                >
                  {saved ? "♥" : "♡"}
                </button>
              </div>

              <div style={{
                fontFamily: FONT_DISPLAY, fontWeight: 400,
                fontSize: 30, lineHeight: 1.08, letterSpacing: "-.02em",
                color: C.ink, textDecoration: "underline", textUnderlineOffset: 5, textDecorationThickness: 1,
              }}>
                {card.title}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  height: 44, padding: "0 18px", borderRadius: 999,
                  background: C.accent, color: "#fff", fontSize: 14, fontWeight: 600,
                }}>
                  Смотреть {typeLabel.toLowerCase()} <span aria-hidden>→</span>
                </span>
              </div>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Share strip ──────────────────────────────────────────────────────────────

function ShareStrip({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}&text=${encodeURIComponent(title)}`;

  return (
    <section style={{ padding: "28px 0 6px" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 28px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 0", borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`,
            flexWrap: "wrap", gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.ink3, fontSize: 13 }}>
              <span style={capsStyle}>Тэги</span>
              {["дети", "новость", "Минск"].map((tag) => (
                <span key={tag} style={{
                  display: "inline-flex", alignItems: "center", height: 26, padding: "0 12px",
                  borderRadius: 999, border: `1px solid ${C.line2}`, fontSize: 12, color: C.ink2,
                }}>
                  {tag}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={tgUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", height: 32, padding: "0 12px",
                  borderRadius: 999, border: `1px solid ${C.line2}`, fontSize: 13, color: C.ink2,
                  textDecoration: "none",
                }}
              >
                ↗ Telegram
              </a>
              <button
                onClick={handleCopy}
                style={{
                  display: "inline-flex", alignItems: "center", height: 32, padding: "0 12px",
                  borderRadius: 999, border: `1px solid ${C.line2}`, fontSize: 13, color: C.ink2,
                  cursor: "pointer", background: "transparent", fontFamily: "inherit",
                }}
              >
                {copied ? "✓ Скопировано" : "↗ Копировать"}
              </button>
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
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 28px" }}>
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

// ─── Footer ───────────────────────────────────────────────────────────────────

function FooterBar() {
  return (
    <footer style={{ padding: "44px 0 72px", borderTop: `1px solid ${C.line}` }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 28px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link href="/blog" style={{ display: "inline-flex", alignItems: "center", gap: 10, color: C.ink, fontSize: 15, textDecoration: "none" }}>
          <span style={{ color: C.accentDeep }}>←</span> Все материалы
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 14, color: C.ink3, fontSize: 12 }}>
          <span style={{ fontFamily: FONT_MONO, letterSpacing: ".1em", textTransform: "uppercase" }}>mamaGo · Минск</span>
          <span style={{ width: 4, height: 4, background: C.ink3, borderRadius: 99 }} />
          <span>журнал · 2026</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Keyframes injector ───────────────────────────────────────────────────────

function GlobalStyles() {
  return (
    <style>{`
      @keyframes bn-marquee { from { transform: translateX(0); } to { transform: translateX(-33.333%); } }
      @keyframes bn-blink { 0%, 60% { opacity: 1; } 80% { opacity: .25; } 100% { opacity: 1; } }
      @keyframes bn-pulse { 0% { box-shadow: 0 0 0 0 rgba(214,52,43,.55); } 70% { box-shadow: 0 0 0 12px rgba(214,52,43,0); } 100% { box-shadow: 0 0 0 0 rgba(214,52,43,0); } }

      /* Drop-cap on lede first paragraph */
      .bn-lede p:first-child::first-letter {
        font-family: ${FONT_DISPLAY};
        float: left;
        font-size: 84px;
        line-height: .82;
        padding: 6px 12px 0 0;
        color: ${C.accentDeep};
      }

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
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  blocks: ArticleMvpResolvedBlock[];
  author: { displayName: string | null; avatarUrl: string | null } | null;
  related: RelatedArticle[];
  draftWatermark?: boolean;
}

export function BreakingNewsView({
  title,
  excerpt,
  publishedAt,
  blocks,
  author,
  related,
  draftWatermark,
}: BreakingNewsViewProps) {
  // Extract gallery URLs from the gallery block.
  const galleryBlock = blocks.find((b): b is Extract<ArticleMvpResolvedBlock, { type: "gallery" }> => b.type === "gallery");
  const galleryUrls = galleryBlock ? galleryBlock.imageUrls.filter((u): u is string => Boolean(u)) : [];

  // Extract activity card block.
  const activityBlock = blocks.find((b): b is Extract<ArticleMvpResolvedBlock, { type: "activityCard" }> => b.type === "activityCard");

  // Build marquee items from article context.
  const marqueeItems = [
    `Breaking · ${title}`,
    "mamaGo · Журнал",
    "Минск · Новости для семей",
    "Читай · Делись · Сохраняй",
    "mamaGo · Открытия · Места · События",
  ];

  const breadcrumbs = ["Главная", "Журнал", title.length > 40 ? title.slice(0, 37) + "…" : title];

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: "100vh", position: "relative" }}>
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
        <div style={{ maxWidth: 1320, margin: "0 auto", padding: "12px 28px 0" }}>
          <div style={{ borderRadius: 10, border: "1px solid #fde68a", background: "#fffbeb", padding: "10px 16px", fontSize: 13, color: "#92400e" }}>
            Черновик / предпросмотр — так видят только редакторы
          </div>
        </div>
      )}

      <Breadcrumbs items={breadcrumbs} />
      <NewsHero title={title} excerpt={excerpt} publishedAt={publishedAt} author={author} />
      <HeroGallery urls={galleryUrls} title={title} />
      <ArticleBody blocks={blocks} />

      {activityBlock?.card && (
        <LinkedEntityCard card={activityBlock.card} entityType={activityBlock.entityType} />
      )}

      <ShareStrip title={title} />
      <RelatedSection items={related} />
      <FooterBar />
    </div>
  );
}
