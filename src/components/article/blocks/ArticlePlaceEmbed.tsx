"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import {
  MapPin,
  ExternalLink,
  ChevronDown,
  Share2,
  Star,
  Phone,
  Mail,
  Globe,
  Instagram,
  Youtube,
  Send,
  Link2,
} from "lucide-react";
import { PlaceSaveHeart } from "@/features/save/PlaceSaveHeart";
import { EventCard } from "@/components/events";
import { toast } from "@/lib/toast";
import { normalizeUiCurrencyText } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import type { SharedContactsData } from "@/domain/contacts/structuredContacts";
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

type ContactLink = {
  key: string;
  label: string;
  href: string;
  external?: boolean;
  kind: "phone" | "email" | "website" | "social";
  icon: ComponentType<{ size?: number }>;
};

export type ArticlePlaceEmbedProps = {
  card: ResolvedPlaceEmbedCard;
  description?: string | null;
  contacts?: SharedContactsData | null;
  priceLabel?: string | null;
  showCta?: boolean;
};

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

const SOCIAL_LABELS: Record<SharedContactsData["socials"][number]["kind"], string> = {
  instagram: "Instagram",
  telegram: "Telegram",
  vk: "VK",
  tiktok: "TikTok",
  youtube: "YouTube",
  other: "Соцсеть",
};

function VkIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3.5 7.5h3c.3 3.3 1.8 5.6 3 6.2V7.5h2.9v4.4c1.2-.2 2.5-1.9 2.9-4.4h2.9c-.3 2.6-1.7 4.4-2.7 5.2 1 .6 2.6 2.2 3.2 4.8h-3.2c-.5-1.7-1.7-3-3.1-3.2v3.2h-.5c-4.1 0-7.1-2.9-8.4-10z" />
    </svg>
  );
}

const SOCIAL_ICON: Record<SharedContactsData["socials"][number]["kind"], ComponentType<{ size?: number }>> = {
  instagram: Instagram,
  telegram: Send,
  vk: VkIcon,
  tiktok: Link2,
  youtube: Youtube,
  other: Link2,
};

function minPriceLabel(items: ArticlePlaceListItem[]): string | null {
  const numeric = items
    .map((item) => item.priceLabel)
    .filter((label): label is string => Boolean(label));
  return numeric[0] ?? null;
}

function buildContactLinks(contacts?: SharedContactsData | null): ContactLink[] {
  if (!contacts) return [];
  const links: ContactLink[] = contacts.phones.map((phone, index) => ({
    key: `phone-${index}-${phone.value}`,
    label: phone.label ? `${phone.label}: ${phone.value}` : phone.value,
    href: `tel:${phone.value.replace(/[^\d+]/g, "")}`,
    kind: "phone",
    icon: Phone,
  }));

  if (contacts.email) {
    links.push({ key: "email", label: contacts.email, href: `mailto:${contacts.email}`, kind: "email", icon: Mail });
  }
  if (contacts.website) {
    links.push({ key: "website", label: "Сайт", href: contacts.website, external: true, kind: "website", icon: Globe });
  }
  contacts.socials.forEach((social, index) => {
    links.push({
      key: `social-${index}-${social.url}`,
      label: SOCIAL_LABELS[social.kind],
      href: social.url,
      external: true,
      kind: "social",
      icon: SOCIAL_ICON[social.kind],
    });
  });
  return links;
}

/** Phone becomes a labeled "Позвонить" pill; everything else is an icon-only circle. */
function ContactActionsRow({ links }: { links: ContactLink[] }) {
  if (links.length === 0) return null;
  const phone = links.find((item) => item.kind === "phone");
  const iconLinks = links.filter((item) => item.kind !== "phone");

  return (
    <>
      {phone && (
        <a
          href={phone.href}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, height: 44, padding: "0 18px", borderRadius: 999,
            border: `1px solid ${T.line2}`, background: T.paper2, color: T.ink, fontSize: 14, fontWeight: 600,
            textDecoration: "none", whiteSpace: "nowrap",
          }}
        >
          <Phone size={15} /> Позвонить
        </a>
      )}
      {iconLinks.map((item) => {
        const Icon = item.icon;
        return (
          <a
            key={item.key}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noopener noreferrer" : undefined}
            aria-label={item.label}
            title={item.label}
            style={{
              width: 44, height: 44, borderRadius: 999, border: `1px solid ${T.line2}`, color: T.ink2,
              display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "none",
            }}
          >
            <Icon size={17} />
          </a>
        );
      })}
    </>
  );
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

function afishaMetaLabel(item: ArticlePlaceAfishaItem): string | undefined {
  const date = item.day && item.month ? `${item.day} ${item.month}` : null;
  return [date, item.meta].filter(Boolean).join(" · ") || undefined;
}

function AfishaRail({ items }: { items: ArticlePlaceAfishaItem[] }) {
  return (
    <div style={{ display: "flex", gap: 16, overflowX: "auto", padding: "2px 20px 4px" }}>
      {items.map((item) => (
        <div key={item.id} style={{ flex: "0 0 160px" }}>
          <EventCard
            id={item.id}
            title={item.title}
            href={item.href}
            imageUrl={item.imageUrl}
            categoryLabel={item.categoryLabel ?? undefined}
            metaLabel={afishaMetaLabel(item)}
            priceLabel={item.priceLabel ?? undefined}
          />
        </div>
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

export function ArticlePlaceEmbed({
  card,
  description,
  contacts,
  priceLabel,
  showCta = true,
}: ArticlePlaceEmbedProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const first = (Object.keys(card.tabs) as TabId[]).find((id) => card.tabs[id].length > 0);
    return first ?? "afisha";
  });

  const availableTabs = (Object.keys(card.tabs) as TabId[]).filter((id) => card.tabs[id].length > 0);
  const activeItems = card.tabs[activeTab];
  const contactLinks = buildContactLinks(contacts);
  const hoursColor = card.isOpenNow == null ? T.ink3 : card.isOpenNow ? T.ok : T.accentDeep;
  const metroDistrictSuffix = [
    card.metroName ? `м. ${card.metroName}` : null,
    card.districtName ? `${card.districtName} р-н` : null,
  ]
    .filter(Boolean)
    .join(", ");

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
        <div className={card.coverImageUrl ? "grid grid-cols-1 sm:grid-cols-[186px_1fr]" : "grid grid-cols-1"}>
          {card.coverImageUrl && (
            <div className="flex items-center justify-center sm:p-5" style={{ background: T.paper2 }}>
              <div className="relative w-full aspect-[16/9] sm:aspect-square sm:rounded-2xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.coverImageUrl} alt={card.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                {card.coverImageCount > 1 && (
                  <span style={{
                    position: "absolute", bottom: 8, left: 8, height: 23, padding: "0 9px", borderRadius: 999,
                    background: "rgba(20,18,16,.78)", color: T.paper, fontFamily: T.mono, fontSize: 9.5,
                    letterSpacing: ".07em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 5,
                  }}>
                    ◲ {card.coverImageCount} фото
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-[13px] px-4 py-4 sm:px-5 sm:py-[18px]" style={{ minWidth: 0 }}>
            {(card.categoryLabel || card.rating) && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {card.categoryLabel && (
                  <span style={{ ...capsStyle, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "1 1 auto" }}>
                    {card.categoryLabel}
                  </span>
                )}
                {card.rating && (
                  <span style={{ ...capsStyle, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", flexShrink: 0, marginLeft: "auto" }}>
                    <Star size={10} style={{ color: T.accent, fill: T.accent }} />
                    {card.rating.value.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}
                  </span>
                )}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {card.hoursMessage && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, overflow: "hidden", minWidth: 0, flex: "1 1 auto", fontSize: 12.5, color: hoursColor }}>
                  {card.isOpenNow != null && <span style={{ width: 6, height: 6, borderRadius: 999, background: hoursColor, flexShrink: 0 }} />}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{card.hoursMessage}</span>
                </span>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto" }}>
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

            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {card.logoUrl && (
                <span style={{ width: 40, height: 40, borderRadius: 11, overflow: "hidden", flexShrink: 0, border: `1px solid ${T.line}`, position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.logoUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                </span>
              )}
              <Link
                href={card.href}
                className="block truncate text-[22px] sm:text-[29px]"
                style={{ minWidth: 0, fontFamily: T.serif, fontWeight: 400, lineHeight: 1, letterSpacing: "-.02em", color: "inherit", textDecoration: "none" }}
              >
                {card.title}
              </Link>
            </div>

            {description && (
              <p style={{ margin: 0, color: T.ink3, fontSize: 13.5, lineHeight: 1.48 }}>
                {description}
              </p>
            )}

            {card.address && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5, color: T.ink2 }}>
                  <MapPin size={14} style={{ color: T.accentDeep, flexShrink: 0, marginTop: 2 }} />
                  <span>
                    {card.address}
                    {metroDistrictSuffix && <span style={{ color: T.ink3 }}> ({metroDistrictSuffix})</span>}
                  </span>
                </div>
                {card.mapsUrl != null && (
                  <div style={{ display: "flex", gap: 6, paddingLeft: 22, flexWrap: "wrap" }}>
                    <a
                      href={card.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        height: 30, padding: "0 10px", borderRadius: 999, border: `1px solid ${T.line}`, background: T.paper2,
                        color: T.ink2, fontSize: 12, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", textDecoration: "none",
                      }}
                    >
                      <ExternalLink size={13} /> Как добраться
                    </a>
                  </div>
                )}
              </div>
            )}

            {priceLabel && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 29, padding: "0 11px", borderRadius: 999, border: `1px solid ${T.line2}`, fontSize: 12.5, color: T.ink2, whiteSpace: "nowrap" }}>
                  Стоимость <b style={{ color: T.ink, fontWeight: 600 }}>{renderCurrencyText(normalizeUiCurrencyText(priceLabel), { iconSize: "sm" })}</b>
                </span>
              </div>
            )}

            {availableTabs.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
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
            )}
          </div>
        </div>

        {open && availableTabs.length > 0 && (
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <ContactActionsRow links={contactLinks} />
              </div>
              {showCta && (
                <Link
                  href={card.href}
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, height: 46, padding: "0 20px",
                    borderRadius: 999, fontWeight: 600, fontSize: 14, background: T.accent, color: "#fff", textDecoration: "none",
                  }}
                >
                  Открыть место <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          </div>
        )}

        {availableTabs.length === 0 && (showCta || contactLinks.length > 0) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap", padding: "15px 20px", borderTop: `1px solid ${T.line}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <ContactActionsRow links={contactLinks} />
            </div>
            {showCta && (
              <Link
                href={card.href}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, height: 44, padding: "0 18px",
                  borderRadius: 999, fontWeight: 600, fontSize: 14, background: T.accent, color: "#fff", textDecoration: "none",
                }}
              >
                Открыть место <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
