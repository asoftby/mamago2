"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Copy,
  ExternalLink,
  ChevronDown,
  Share2,
  Star,
} from "lucide-react";
import { PlaceSaveHeart } from "@/features/save/PlaceSaveHeart";
import { toast } from "@/lib/toast";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import type {
  ArticlePlaceAfishaItem,
  ArticlePlaceListItem,
  ResolvedPlaceEmbedCard,
} from "@/lib/place/articlePlaceEmbedData";

// Same palette as ArticleOfferEmbed.tsx — the house editorial design system.
const T = {
  ink: "#141210",
  ink2: "#3A332B",
  ink3: "rgba(20,18,16,.55)",
  paper: "#FAF7F1",
  paper2: "#F6F0E8",
  line: "rgba(20,18,16,.10)",
  line2: "rgba(20,18,16,.18)",
  lineWarm: "#E7E0D7",
  accent: "#E86A3A",
  accentDeep: "#C24E22",
  accentSoft: "#FFE8DC",
  ok: "#1F8A5B",
  okBg: "rgba(31,138,91,.10)",
  mono: "var(--font-mono, 'JetBrains Mono', ui-monospace, monospace)",
  serif: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
  sans: "var(--font-sans, 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif)",
} as const;

const capsStyle: React.CSSProperties = {
  fontFamily: T.mono,
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: ".14em",
  color: T.ink3,
};

type TabId = "afisha" | "visit" | "party" | "promo";

const TAB_LABELS: Record<TabId, string> = {
  afisha: "Афиша",
  visit: "Посещение",
  party: "Праздник",
  promo: "Специальные",
};

const QUICK_LABELS: Record<TabId, string> = {
  afisha: "Афиша",
  visit: "Посещение",
  party: "Праздник",
  promo: "✦ Спецпредложения",
};

function minPriceLabel(items: ArticlePlaceListItem[]): string | null {
  const numeric = items
    .map((item) => item.priceLabel)
    .filter((label): label is string => Boolean(label));
  return numeric[0] ?? null;
}

async function copyToClipboard(text: string, message: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(message);
  } catch {
    toast(text);
  }
}

function sharePlace(title: string, href: string) {
  const url = typeof window !== "undefined" ? new URL(href, window.location.origin).toString() : href;
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator.share({ title, url }).catch(() => {});
    return;
  }
  copyToClipboard(url, `Ссылка на «${title}» скопирована`);
}

function AfishaRail({ items }: { items: ArticlePlaceAfishaItem[] }) {
  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "2px 20px 4px" }}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          style={{ flex: "0 0 172px", display: "flex", flexDirection: "column", gap: 8, textDecoration: "none", color: "inherit" }}
        >
          <div style={{ position: "relative", aspectRatio: "4 / 3", borderRadius: 13, overflow: "hidden", background: T.paper2 }}>
            {item.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt={item.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            )}
            {item.day && item.month && (
              <div style={{
                position: "absolute", top: 8, left: 8, width: 40, borderRadius: 10,
                background: "rgba(250,247,241,.95)", textAlign: "center", padding: "4px 0 3px", lineHeight: 1,
              }}>
                <b style={{ display: "block", fontFamily: T.serif, fontSize: 18, color: T.ink, fontWeight: 400 }}>{item.day}</b>
                <i style={{ display: "block", fontStyle: "normal", fontFamily: T.mono, fontSize: 7.5, letterSpacing: ".06em", textTransform: "uppercase", color: T.ink3, marginTop: 2 }}>{item.month}</i>
              </div>
            )}
            {item.categoryLabel && (
              <span style={{
                position: "absolute", bottom: 8, left: 8, height: 19, padding: "0 7px", borderRadius: 999,
                background: "rgba(20,18,16,.82)", color: T.paper, fontFamily: T.mono, fontSize: 8.5,
                fontWeight: 500, letterSpacing: ".07em", textTransform: "uppercase", display: "inline-flex", alignItems: "center",
              }}>
                {item.categoryLabel}
              </span>
            )}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.28 }}>{item.title}</span>
          {item.meta && <span style={{ fontSize: 12, color: T.ink3 }}>{item.meta}</span>}
          {item.priceLabel && (
            <span style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 600 }}>
              {renderCurrencyText(normalizeUiCurrencyText(item.priceLabel), { iconSize: "sm" })}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

function ListPane({ items, promo }: { items: ArticlePlaceListItem[]; promo?: boolean }) {
  return (
    <div style={{ maxHeight: 326, overflowY: "auto", padding: "6px 20px 16px" }}>
      {items.map((item, index) => (
        <Link
          key={item.id}
          href={item.href}
          style={{
            display: "flex", alignItems: "center", gap: 13, padding: "12px 0",
            borderTop: index === 0 ? "none" : `1px solid ${T.line}`,
            textDecoration: "none", color: "inherit",
            ...(promo ? { background: `linear-gradient(90deg, ${T.accentSoft} 0%, transparent 62%)`, borderRadius: 12, padding: 12, borderTop: "none", marginTop: index === 0 ? 0 : 8 } : {}),
          }}
        >
          <span style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: promo ? T.accent : T.accentSoft, color: promo ? "#fff" : T.accentDeep,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
          }}>
            {promo ? "✦" : "●"}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            {item.tag && (
              <span style={{
                display: "inline-flex", alignItems: "center", height: 19, padding: "0 8px", borderRadius: 999,
                background: T.accent, color: "#fff", fontFamily: T.mono, fontSize: 9, fontWeight: 600,
                letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 5,
              }}>
                {item.tag}
              </span>
            )}
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>{item.title}</span>
            {item.meta && <span style={{ display: "block", fontSize: 12.5, color: T.ink3, lineHeight: 1.4, marginTop: 2 }}>{item.meta}</span>}
          </span>
          {item.priceLabel && (
            <span style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 600, color: promo ? T.accentDeep : T.ink, whiteSpace: "nowrap" }}>
              {renderCurrencyText(normalizeUiCurrencyText(item.priceLabel), { iconSize: "sm" })}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

export function ArticlePlaceEmbed({ card }: { card: ResolvedPlaceEmbedCard }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const first = (Object.keys(card.tabs) as TabId[]).find((id) => card.tabs[id].length > 0);
    return first ?? "afisha";
  });

  const availableTabs = (Object.keys(card.tabs) as TabId[]).filter((id) => card.tabs[id].length > 0);
  const activeItems = card.tabs[activeTab];

  const hoursColor = card.isOpenNow == null ? T.ink3 : card.isOpenNow ? T.ok : T.accentDeep;

  return (
    <div className="not-prose my-8 md:my-10">
      <div style={{
        background: T.paper,
        border: `1px solid ${T.line}`,
        borderRadius: 22,
        overflow: "hidden",
        boxShadow: "0 24px 50px -34px rgba(20,18,16,.28)",
        fontFamily: T.sans,
        color: T.ink,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: card.coverImageUrl ? "186px 1fr" : "1fr", gap: 0 }}>
          {card.coverImageUrl && (
            <div style={{ position: "relative", minHeight: 230 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.coverImageUrl} alt={card.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              {card.coverImageCount > 1 && (
                <span style={{
                  position: "absolute", bottom: 10, left: 10, height: 23, padding: "0 9px", borderRadius: 999,
                  background: "rgba(20,18,16,.78)", color: T.paper, fontFamily: T.mono, fontSize: 9.5,
                  letterSpacing: ".07em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 5,
                }}>
                  ◲ {card.coverImageCount} фото
                </span>
              )}
            </div>
          )}

          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 13, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 11, minWidth: 0 }}>
                {card.logoUrl && (
                  <span style={{ width: 40, height: 40, borderRadius: 11, overflow: "hidden", flexShrink: 0, border: `1px solid ${T.line}`, position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={card.logoUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  </span>
                )}
                <div style={{ minWidth: 0 }}>
                  {card.categoryLabel && <span style={{ ...capsStyle, display: "block", marginBottom: 4 }}>{card.categoryLabel}</span>}
                  <Link href={card.href} style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 29, lineHeight: 1, letterSpacing: "-.02em", display: "block", color: "inherit", textDecoration: "none" }}>
                    {card.title}
                  </Link>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {card.rating && (
                  <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5, fontSize: 15, fontWeight: 600, whiteSpace: "nowrap" }}>
                    <Star size={13} style={{ color: T.accent, fill: T.accent, position: "relative", top: 1 }} />
                    {card.rating.value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}
                    <i style={{ fontStyle: "normal", fontWeight: 400, color: T.ink3, fontSize: 12.5 }}>· {card.rating.count}</i>
                  </span>
                )}
                <PlaceSaveHeart
                  placeId={card.placeId}
                  placeSlug={card.slug}
                  placeTitle={card.title}
                  coverImageUrl={card.coverImageUrl}
                  source="article-place-embed"
                  className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border transition-colors"
                  iconClassName="h-4 w-4"
                />
                <button
                  type="button"
                  onClick={() => sharePlace(card.title, card.href)}
                  aria-label="Поделиться"
                  style={{
                    width: 34, height: 34, borderRadius: 999, border: `1px solid ${T.line2}`, color: T.ink3,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", background: "none",
                  }}
                >
                  <Share2 size={16} />
                </button>
              </div>
            </div>

            {card.address && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13.5, color: T.ink2 }}>
                <MapPin size={14} style={{ color: T.accentDeep, flexShrink: 0 }} />
                <span>{card.address}</span>
                <span style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
                  {card.mapsUrl != null && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            card.lat != null && card.lng != null
                              ? `${card.lat}, ${card.lng}`
                              : card.address ?? "",
                            card.lat != null && card.lng != null ? "Координаты скопированы" : "Адрес скопирован",
                          )
                        }
                        style={{
                          height: 30, padding: "0 10px", borderRadius: 999, border: `1px solid ${T.line}`, background: T.paper2,
                          color: T.ink2, fontSize: 12, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", cursor: "pointer",
                        }}
                      >
                        <Copy size={13} /> Копировать
                      </button>
                      <a
                        href={card.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          height: 30, padding: "0 10px", borderRadius: 999, border: `1px solid ${T.line}`, background: T.paper2,
                          color: T.ink2, fontSize: 12, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", textDecoration: "none",
                        }}
                      >
                        <ExternalLink size={13} /> Google Maps
                      </a>
                    </>
                  )}
                </span>
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {card.hoursMessage && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6, height: 29, padding: "0 11px", borderRadius: 999,
                  border: `1px solid ${card.isOpenNow == null ? T.line2 : card.isOpenNow ? "rgba(31,138,91,.28)" : "rgba(194,78,34,.28)"}`,
                  fontSize: 12.5, color: hoursColor, whiteSpace: "nowrap",
                }}>
                  {card.isOpenNow != null && <span style={{ width: 6, height: 6, borderRadius: 999, background: hoursColor }} />}
                  {card.hoursMessage}
                </span>
              )}
              {card.metroName && (
                <span style={{ display: "inline-flex", alignItems: "center", height: 29, padding: "0 11px", borderRadius: 999, border: `1px solid ${T.line2}`, fontSize: 12.5, color: T.ink2, whiteSpace: "nowrap" }}>
                  м. {card.metroName}
                </span>
              )}
              {card.ageTags.slice(0, 2).map((tag) => (
                <span key={tag} style={{ display: "inline-flex", alignItems: "center", height: 29, padding: "0 11px", borderRadius: 999, border: `1px solid ${T.line2}`, fontSize: 12.5, color: T.ink2, whiteSpace: "nowrap" }}>
                  {tag}
                </span>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
              <span style={{ ...capsStyle, marginRight: 2 }}>сейчас</span>
              {availableTabs.map((id) => {
                const count = card.tabs[id].length;
                const priceHint = id === "visit" || id === "party" ? minPriceLabel(card.tabs[id]) : null;
                const isPromo = id === "promo";
                return (
                  <span
                    key={id}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 7, height: 32, padding: "0 12px", borderRadius: 999,
                      background: isPromo ? T.accentSoft : T.paper2, border: isPromo ? "1px solid transparent" : `1px solid ${T.line}`,
                      fontSize: 12.5, color: isPromo ? T.accentDeep : T.ink2, whiteSpace: "nowrap",
                    }}
                  >
                    {QUICK_LABELS[id]}{" "}
                    <b style={{ color: isPromo ? T.accentDeep : T.ink, fontWeight: 600 }}>
                      {priceHint ? renderCurrencyText(normalizeUiCurrencyText(priceHint), { iconSize: "sm" }) : count}
                    </b>
                  </span>
                );
              })}
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                style={{
                  marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, height: 32, padding: "0 13px",
                  borderRadius: 999, border: `1px solid ${T.ink}`, background: T.ink, color: T.paper, fontSize: 12.5,
                  fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer",
                }}
              >
                {open ? "Свернуть" : "Все предложения"}
                <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .25s" }} />
              </button>
            </div>
          </div>
        </div>

        {open && (
          <div style={{ borderTop: `1px solid ${T.line}` }}>
            <div style={{ display: "flex", gap: 2, padding: "0 20px", borderBottom: `1px solid ${T.line}`, overflowX: "auto" }}>
              {availableTabs.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  style={{
                    position: "relative", display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 12px",
                    fontSize: 13.5, fontWeight: 600, color: activeTab === id ? T.ink : T.ink3, whiteSpace: "nowrap",
                    background: "none", border: "none", cursor: "pointer",
                    borderBottom: activeTab === id ? `2px solid ${T.accent}` : "2px solid transparent",
                  }}
                >
                  {TAB_LABELS[id]}{" "}
                  <span style={{
                    fontFamily: T.mono, fontSize: 10.5, fontWeight: 500, padding: "1px 6px", borderRadius: 999,
                    background: activeTab === id ? T.accentSoft : "rgba(20,18,16,.07)", color: activeTab === id ? T.accentDeep : T.ink3,
                  }}>
                    {card.tabs[id].length}
                  </span>
                </button>
              ))}
            </div>

            {activeTab === "afisha" ? (
              <AfishaRail items={activeItems as ArticlePlaceAfishaItem[]} />
            ) : (
              <ListPane items={activeItems as ArticlePlaceListItem[]} promo={activeTab === "promo"} />
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", padding: "15px 20px", borderTop: `1px solid ${T.line}` }}>
              <span style={{ fontSize: 12.5, color: T.ink3 }}>Бронирование и полная афиша — на странице места</span>
              <Link
                href={card.href}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, height: 46, padding: "0 20px",
                  borderRadius: 999, fontWeight: 600, fontSize: 14, background: T.accent, color: "#fff", textDecoration: "none",
                }}
              >
                Открыть место <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderTop: `1px solid ${T.line}`, fontSize: 11.5, color: T.ink3, background: "rgba(20,18,16,.015)" }}>
          Обновляется автоматически из бизнес-аккаунта «{card.title}» · {card.updatedAt}
        </div>
      </div>
    </div>
  );
}
