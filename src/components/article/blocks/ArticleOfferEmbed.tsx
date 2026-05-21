"use client";

import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import { SaveHeart } from "@/features/save/SaveHeart";
import { CampShiftBookingOverlay } from "@/components/offers/CampShiftBookingOverlay";
import type { ArticleShiftPreview, ResolvedOfferEmbedCard } from "@/lib/article/articleMvpRenderData";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  ink:        "#141210",
  ink2:       "#3A332B",
  ink3:       "rgba(20,18,16,.55)",
  ink4:       "#7C5A45",
  paper:      "#FAF7F1",
  paper2:     "#F6F0E8",
  paper3:     "#EFE7DD",
  line:       "rgba(20,18,16,.10)",
  line2:      "rgba(20,18,16,.18)",
  lineWarm:   "#E7E0D7",
  accent:     "#E86A3A",
  accentDeep: "#C24E22",
  hot:        "#D6342B",   // promo-pill is RED, not orange
  titleAmber: "#FFC183",   // italic portion of title on hero
  mono:       "var(--font-mono, 'JetBrains Mono', ui-monospace, monospace)",
  serif:      "var(--font-serif, 'Instrument Serif', Georgia, serif)",
  sans:       "var(--font-sans, 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif)",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

function parseDMY(d?: string) {
  if (!d) return null;
  const m = d.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return { day: +m[1], month: +m[2], year: +m[3] };
}

function fmtRange(shift: ArticleShiftPreview): string {
  const f = parseDMY(shift.dateFrom), t = parseDMY(shift.dateTo);
  if (f && t) {
    if (f.month === t.month) return `${f.day}–${t.day} ${MONTHS[f.month-1]}`;
    return `${f.day} ${MONTHS[f.month-1]} – ${t.day} ${MONTHS[t.month-1]}`;
  }
  if (f) return `${f.day} ${MONTHS[f.month-1]}`;
  return "";
}

function fmtDuration(shift: ArticleShiftPreview): string {
  if (shift.duration) return shift.duration;
  const f = parseDMY(shift.dateFrom), t = parseDMY(shift.dateTo);
  if (f && t) {
    const days = Math.round(
      (new Date(t.year, t.month-1, t.day).getTime() -
       new Date(f.year, f.month-1, f.day).getTime()) / 86_400_000
    ) + 1;
    return `${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"}`;
  }
  return "";
}

/** Render title: text inside «» becomes italic amber for editorial look. */
function TitleNode({ text }: { text: string }) {
  const parts = text.split(/(«[^»]*».*)/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <i key={i} style={{ fontStyle: "italic", color: T.titleAmber }}>{p}</i>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ArticleOfferEmbed({ card }: { card: ResolvedOfferEmbedCard }) {
  const [selectedIdx, setSelectedIdx]     = useState(0);
  const [bookingOpen, setBookingOpen]     = useState(false);
  const [expandedIdx, setExpandedIdx]     = useState<number | null>(null);

  const hasShifts  = card.ctaMode === "camp-shift" && card.schedulePreview.length > 0;
  const activeShift: ArticleShiftPreview | null = hasShifts
    ? (card.schedulePreview[selectedIdx] ?? card.schedulePreview[0])
    : null;

  const handleCta = () => {
    if (card.ctaMode === "camp-shift" && activeShift) { setBookingOpen(true); return; }
    if (card.ctaMode === "phone"    && card.ctaPhone) { window.location.href = `tel:${card.ctaPhone.replace(/[^\d+]/g,"")}`; return; }
    if (card.ctaMode === "external" && card.ctaHref)  { window.open(card.ctaHref, "_blank", "noopener,noreferrer"); return; }
    window.location.href = card.href;
  };

  // Accordion items — only show if at least one has content
  const accordionItems = [
    { label: "Описание",        content: card.shortDescription || null },
    { label: "Расписание дня",  content: null },
    { label: "Проживание",      content: null },
  ];

  return (
    <div className="not-prose my-8 md:my-10">
      {/* ── Card shell ──────────────────────────────────────────────── */}
      <div style={{
        background: "#fff",
        border: `0.666px solid ${T.lineWarm}`,
        borderRadius: 24,
        overflow: "hidden",
        boxShadow: `rgba(20,18,16,.06) 0px 16px 40px 0px`,
        fontFamily: T.sans,
        color: T.ink,
      }}>

        {/* ── HERO IMAGE ────────────────────────────────────────────── */}
        <div style={{ position: "relative", aspectRatio: "16/7", background: T.paper3 }}>

          {/* Image */}
          {card.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.imageUrl}
              alt={card.title}
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover",
              }}
            />
          )}

          {/* Placeholder when no image */}
          {!card.imageUrl && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width={48} height={48} viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="1.7"
                   strokeLinecap="round" strokeLinejoin="round"
                   style={{ color: T.ink3, opacity: 0.25 }}>
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="2" />
                <path d="M21 16l-5-5-9 9" />
              </svg>
            </div>
          )}

          {/* Gradient overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(20,18,16,.88) 0%, rgba(20,18,16,.4) 52%, transparent 75%)",
          }} />

          {/* Pills row — top-left */}
          <div style={{
            position: "absolute", top: 16, left: 16,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {/* Type pill */}
            <span style={{
              display: "inline-flex", alignItems: "center",
              height: 26, padding: "0 12px",
              borderRadius: 99,
              background: "rgba(250,247,241,.92)",
              color: T.ink4,
              fontFamily: T.mono,
              fontSize: 11, fontWeight: 600,
              letterSpacing: "1.76px", textTransform: "uppercase",
              boxShadow: "rgba(20,18,16,.06) 0px 1px 3px 0px",
            }}>
              {card.typeLabel}
            </span>

            {/* Discount pill — RED */}
            {card.discountBadge && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                height: 26, padding: "5px 10px",
                borderRadius: 99,
                background: T.hot,
                color: "#fff",
                fontFamily: T.mono,
                fontSize: 10, fontWeight: 600,
                letterSpacing: "1.2px", textTransform: "uppercase",
              }}>
                <span>●</span>{card.discountBadge}
              </span>
            )}
          </div>

          {/* Save button — top-right */}
          <div style={{ position: "absolute", top: 16, right: 16 }}>
            <SaveHeart
              activityId={card.offerId}
              offerId={card.offerId}
              activityTitle={card.title}
              coverImageUrl={card.imageUrl}
              source="article-offer-embed"
              className="h-9 w-9 !bg-[rgba(250,247,241,.94)] !rounded-full !shadow-[rgba(20,18,16,.12)_0px_6px_18px_0px]"
              iconClassName="h-4 w-4"
            />
          </div>

          {/* Rating badge — bottom-right */}
          {card.ratingValue != null && (
            <div style={{ position: "absolute", bottom: 16, right: 16 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "5px 10px", borderRadius: 99,
                background: "rgba(20,18,16,.72)",
                color: T.paper,
                fontFamily: T.mono,
                fontSize: 10, fontWeight: 500, letterSpacing: ".08em",
              }}>
                <Star style={{ width: 12, height: 12, flexShrink: 0, fill: "#FFC857", stroke: "none" }} />
                {card.ratingValue.toFixed(1)}
                {card.ratingCount != null && (
                  <span style={{ color: "rgba(250,247,241,.55)" }}>
                    · {card.ratingCount}&nbsp;отз.
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Title block — bottom-left */}
          <div style={{
            position: "absolute", bottom: 18, left: 24,
            maxWidth: "75%",
          }}>
            {card.placeName && (
              <p style={{
                margin: "0 0 6px",
                fontFamily: T.mono,
                fontSize: 10, fontWeight: 400,
                letterSpacing: "1.4px", textTransform: "uppercase",
                color: "rgba(250,247,241,.7)",
                lineHeight: 1.5,
              }}>
                ● {card.placeName}
              </p>
            )}
            <Link href={card.href} className="block group/htitle">
              <h3 style={{
                margin: 0,
                fontFamily: T.serif,
                fontWeight: 400,
                fontSize: "clamp(22px, 4vw, 36px)",
                lineHeight: 1,
                letterSpacing: "-0.72px",
                color: T.paper,
              }}
              className="transition-opacity duration-150 group-hover/htitle:opacity-80"
              >
                <TitleNode text={card.title} />
              </h3>
            </Link>
          </div>
        </div>

        {/* ── CONTENT BODY ──────────────────────────────────────────── */}
        <div style={{ padding: "22px 24px" }}>

          {/* "ЧТО ВНУТРИ" header */}
          {card.metaItems.length > 0 && (
            <>
              <div style={{
                display: "flex", alignItems: "center", gap: 14,
                marginBottom: 14,
              }}>
                <span style={{
                  fontFamily: T.mono,
                  fontSize: 11, fontWeight: 400,
                  letterSpacing: "1.98px", textTransform: "uppercase",
                  color: T.ink3,
                  whiteSpace: "nowrap",
                }}>
                  Что внутри
                </span>
                <span style={{
                  flex: 1, height: 1,
                  background: T.line,
                }} />
              </div>

              {/* Meta grid — 2 columns */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                marginBottom: 22,
              }}>
                {card.metaItems.slice(0, 4).map((item, i) => {
                  const isLastRow = i >= card.metaItems.slice(0,4).length - 2;
                  const isRightCol = i % 2 === 1;
                  return (
                    <div key={item.id} style={{
                      padding: "28px 24px 28px",
                      borderBottom: isLastRow ? "none" : `0.666px solid ${T.line}`,
                      borderRight: !isRightCol ? `0.666px solid ${T.line}` : "none",
                    }}>
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 18,
                      }}>
                        <span style={{
                          fontFamily: T.mono,
                          fontSize: 11, fontWeight: 400,
                          letterSpacing: "1.98px", textTransform: "uppercase",
                          color: T.ink3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {item.label}
                        </span>
                        <span style={{
                          fontFamily: T.mono,
                          fontSize: 11, fontWeight: 400,
                          letterSpacing: "0.22px",
                          color: "rgba(20,18,16,.25)",
                          flexShrink: 0,
                        }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <div style={{
                        fontFamily: T.serif,
                        fontWeight: 400,
                        fontSize: "clamp(28px, 4vw, 52px)",
                        letterSpacing: "-1.82px",
                        lineHeight: 0.94,
                        color: T.ink,
                        marginBottom: 14,
                      }}>
                        {item.value}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Accordion */}
          <div style={{ marginBottom: hasShifts ? 0 : 4 }}>
            {accordionItems.map((item, i) => {
              const isExpanded = expandedIdx === i;
              const hasContent = Boolean(item.content);
              return (
                <div key={i} style={{
                  borderTop: `0.666px solid ${T.line}`,
                }}>
                  <button
                    type="button"
                    onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    style={{
                      width: "100%",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "16px 0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 14,
                      textAlign: "left",
                    }}
                  >
                    <span style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 14,
                    }}>
                      <span style={{
                        fontFamily: T.mono,
                        fontSize: 10, fontWeight: 400,
                        letterSpacing: "1.4px", textTransform: "uppercase",
                        color: T.ink3,
                        minWidth: 24,
                        flexShrink: 0,
                      }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{
                        fontFamily: T.serif,
                        fontSize: 22, fontWeight: 400,
                        letterSpacing: "-0.33px",
                        lineHeight: "22px",
                        color: T.ink,
                      }}>
                        {item.label}
                      </span>
                    </span>
                    <span style={{
                      fontFamily: T.sans,
                      fontSize: 18, fontWeight: 300,
                      color: T.ink3,
                      lineHeight: 1,
                      transition: "transform .2s",
                      transform: isExpanded ? "rotate(45deg)" : "none",
                      flexShrink: 0,
                    }}>
                      +
                    </span>
                  </button>

                  {isExpanded && (
                    <div style={{ paddingBottom: 16 }}>
                      {hasContent ? (
                        <p style={{
                          margin: 0,
                          fontFamily: T.sans,
                          fontSize: 14, lineHeight: 1.6,
                          color: T.ink2,
                        }}>
                          {item.content}
                        </p>
                      ) : (
                        <Link href={card.href} style={{
                          fontFamily: T.mono,
                          fontSize: 11, letterSpacing: ".08em",
                          color: T.ink3,
                          textDecoration: "underline",
                          textUnderlineOffset: 3,
                        }}>
                          Смотреть на странице предложения →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── SHIFTS DARK SECTION ───────────────────────────────────── */}
        {hasShifts && activeShift ? (
          <div style={{ background: T.ink }}>

            {/* Shift carousel */}
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: "14px 16px 0",
                overflowX: "auto",
                scrollbarWidth: "none",
              }}
            >
              {card.schedulePreview.map((shift, idx) => {
                const isActive = idx === selectedIdx;
                const lowSpots = (shift.spotsLeft ?? 999) < 5;
                const spotsStr =
                  shift.spotsLeft != null && shift.capacity != null
                    ? `${shift.spotsLeft} / ${shift.capacity} мест`
                    : shift.spotsLeft != null ? `${shift.spotsLeft} мест`
                    : null;
                return (
                  <button
                    key={shift.shiftId ?? idx}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    style={{
                      flexShrink: 0,
                      minWidth: 130,
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "none",
                      background: isActive ? "rgba(255,255,255,.15)" : "rgba(255,255,255,.07)",
                      outline: isActive ? "1.5px solid rgba(255,255,255,.28)" : "none",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background .15s",
                    }}
                  >
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 4,
                      marginBottom: 4,
                    }}>
                      <span style={{
                        fontFamily: T.mono,
                        fontSize: 9, fontWeight: 400,
                        letterSpacing: ".16em", textTransform: "uppercase",
                        color: "rgba(250,247,241,.45)",
                      }}>
                        {shift.title ?? `Смена ${idx + 1}`}
                      </span>
                      {shift.promoLabel && (
                        <span style={{
                          fontFamily: T.mono,
                          fontSize: 9, fontWeight: 700,
                          letterSpacing: ".06em",
                          color: T.accent,
                          whiteSpace: "nowrap",
                        }}>
                          {shift.promoLabel}
                        </span>
                      )}
                    </div>
                    <p style={{
                      margin: "0 0 4px",
                      fontFamily: T.serif,
                      fontSize: 15, lineHeight: 1.15,
                      color: T.paper,
                    }}>
                      {fmtRange(shift)}
                    </p>
                    {spotsStr && (
                      <p style={{
                        margin: 0,
                        fontFamily: T.mono,
                        fontSize: 9, letterSpacing: ".06em",
                        color: lowSpots ? T.accent : "rgba(250,247,241,.4)",
                      }}>
                        {lowSpots ? "● " : ""}{spotsStr}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active shift detail bar */}
            <div style={{ padding: "14px 16px 18px" }}>
              {/* Promo + meta line */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 12,
              }}>
                {activeShift.promoLabel && (
                  <span style={{
                    display: "inline-flex", alignItems: "center",
                    height: 20, padding: "0 8px", borderRadius: 99,
                    background: "rgba(232,106,58,.22)",
                    color: T.accent,
                    fontFamily: T.mono,
                    fontSize: 10, fontWeight: 700,
                    letterSpacing: ".1em", textTransform: "uppercase",
                  }}>
                    {activeShift.promoLabel}
                  </span>
                )}
                <span style={{
                  fontFamily: T.mono,
                  fontSize: 11, letterSpacing: ".06em",
                  color: "rgba(250,247,241,.45)",
                }}>
                  {fmtRange(activeShift)}
                  {fmtDuration(activeShift) ? ` · ${fmtDuration(activeShift)}` : ""}
                </span>
                {activeShift.spotsLeft != null && activeShift.capacity != null && (
                  <span style={{
                    fontFamily: T.mono,
                    fontSize: 11, letterSpacing: ".04em",
                    color: activeShift.spotsLeft < 5 ? T.accent : "rgba(250,247,241,.35)",
                  }}>
                    · осталось {activeShift.spotsLeft} из {activeShift.capacity} мест
                  </span>
                )}
                {activeShift.ageRange && (
                  <span style={{
                    fontFamily: T.mono,
                    fontSize: 11, letterSpacing: ".04em",
                    color: "rgba(250,247,241,.3)",
                  }}>
                    · {activeShift.ageRange}
                  </span>
                )}
              </div>

              {/* Price + CTA */}
              <div style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: (activeShift.price || card.priceLabel) ? "space-between" : "flex-end",
                gap: 14,
              }}>
                {(activeShift.price || card.priceLabel) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {activeShift.oldPrice && (
                      <span style={{
                        fontFamily: T.mono,
                        fontSize: 12, letterSpacing: ".04em",
                        color: "rgba(250,247,241,.32)",
                        textDecoration: "line-through",
                      }}>
                        {activeShift.oldPrice}
                      </span>
                    )}
                    <span style={{
                      fontFamily: T.serif,
                      fontSize: "clamp(26px, 4vw, 36px)",
                      lineHeight: 1, letterSpacing: "-0.02em",
                      color: T.paper,
                    }}>
                      {activeShift.price ?? card.priceLabel}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCta}
                  className="hover:opacity-90 active:scale-[.98]"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    height: 46, padding: "0 22px",
                    borderRadius: 99,
                    background: T.accent,
                    color: "#fff",
                    border: "none", cursor: "pointer",
                    fontFamily: T.sans,
                    fontSize: 14, fontWeight: 600, letterSpacing: "-0.005em",
                    whiteSpace: "nowrap", flexShrink: 0,
                    transition: "background .2s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.accentDeep; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = T.accent; }}
                >
                  {card.ctaLabel}
                </button>
              </div>

              {/* Footer link */}
              <div style={{ marginTop: 10, textAlign: "right" }}>
                <Link href={card.href} style={{
                  fontFamily: T.mono,
                  fontSize: 11, letterSpacing: ".04em",
                  color: "rgba(250,247,241,.3)",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}>
                  Открыть страницу предложения →
                </Link>
              </div>
            </div>
          </div>

        ) : (
          /* ── No shifts: price + CTA ───────────────────────────────── */
          <div style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: card.priceLabel ? "space-between" : "flex-end",
            gap: 14,
            padding: "16px 24px 22px",
            borderTop: `0.666px solid ${T.line}`,
          }}>
            {card.priceLabel && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{
                  fontFamily: T.mono,
                  fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase",
                  color: T.ink3,
                }}>от</span>
                <span style={{
                  fontFamily: T.serif,
                  fontSize: "clamp(26px, 4vw, 36px)",
                  lineHeight: 1, letterSpacing: "-0.02em",
                  color: T.ink,
                }}>
                  {card.priceLabel}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={handleCta}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                height: 46, padding: "0 22px",
                borderRadius: 99,
                background: T.accent, color: "#fff",
                border: "none", cursor: "pointer",
                fontFamily: T.sans,
                fontSize: 14, fontWeight: 600, letterSpacing: "-0.005em",
                whiteSpace: "nowrap", flexShrink: 0,
                transition: "background .2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.accentDeep; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = T.accent; }}
            >
              {card.ctaLabel}
            </button>
          </div>
        )}
      </div>

      {/* Booking overlay */}
      {card.ctaMode === "camp-shift" && (
        <CampShiftBookingOverlay
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          offerId={card.offerId}
          offerTitle={card.title}
          shift={activeShift}
          shifts={card.schedulePreview}
        />
      )}
    </div>
  );
}
