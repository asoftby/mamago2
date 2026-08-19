/**
 * family-by-afisha-event.parser.ts
 *
 * Production EVENT parser для family.by — афиша событий.
 * parserKey: "family-by-afisha-event"
 * entityType: EVENT
 *
 * Strategy:
 *   1. Load listing page (source.baseUrl or default https://family.by/afisha/)
 *   2. Collect date sub-pages (https://family.by/afisha/YYYY/MM/DD/) — up to configured maxDatePages
 *   3. From each page extract detail links: /afisha/\d+-slug.html
 *   4. Visit each detail page, extract event fields
 *   5. Return ParsedRawRecord[]
 *
 * Detail page fields:
 *   og:title                → title
 *   <div id="news-id-N">    → fullDescription (весь основной контейнер, баланс div)
 *   <b>Возраст:</b> / strong → ageText
 *   «Время проведения» (strong + div.xfpovtor целиком) → scheduleText + startAt (ISO, Europe/Minsk +3)
 *   <b>Стоимость:</b>       → priceText
 *   <b>Место:</b>           → venueName + addressText
 *   <b>Телефон:</b>         → phone (stored in rawPayload)
 *   <!--TBegin:url|--> og:image uploads/posts full-size → imageUrls (thumbs / data-src fallback)
 *
 * typeCandidate / scheduleModeCandidate:
 *   Derived from title/description keywords — best-effort hints only.
 *   Final mapping to ActivityType/ScheduleMode stays in existing apply layer.
 *
 * Encoding: windows-1251 (family.by legacy)
 * User-Agent: Chrome-like (required — server returns 0 bytes for bot UA)
 */

import type { ImportSource } from "@prisma/client";
import type { EventImportParser } from "./base.parser";
import type { ParserResult, ParsedRawRecord } from "../types";
import { errorParserResult } from "./base.parser";
import { getParserDefinition } from "./parser-definitions";
import { fetchHtml } from "./fetchHtml";
import { parseRussianDayMonthTimeToIsoMinsk } from "@/lib/dates/parseRussianDayMonthTimeMinsk";

export { parseRussianDayMonthTimeToIsoMinsk };

const PARSER_KEY = "family-by-afisha-event";
const BASE_URL = "https://family.by";
const DEFAULT_LISTING_URL = `${BASE_URL}/afisha/`;
const DELAY_MS = 300;
const DEFAULT_MAX_DETAIL_PAGES = 50;
const DEFAULT_MAX_DATE_PAGES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Link extraction ───────────────────────────────────────────────────────────

/**
 * Extract event detail links from a listing/date page.
 * Pattern: /afisha/\d+-slug.html (absolute or relative, may contain \n)
 */
function extractEventDetailLinks(html: string, pageUrl: string): string[] {
  const seen = new Set<string>();
  const links: string[] = [];
  const re = /href="([^"]+)"/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const cleaned = m[1].replace(/[\s\n\r\t]/g, "");
    if (!cleaned) continue;
    try {
      const url = new URL(cleaned, pageUrl);
      if (url.hostname !== "family.by") continue;
      if (!/\/afisha\/\d+-[a-z0-9-]+\.html$/.test(url.pathname)) continue;
      url.hash = "";
      url.search = "";
      const norm = url.toString();
      if (!seen.has(norm)) {
        seen.add(norm);
        links.push(norm);
      }
    } catch {
      // ignore invalid URLs
    }
  }
  return links;
}

/**
 * Extract date sub-page links from listing page.
 * Pattern: /afisha/YYYY/MM/DD/
 * Returns up to maxDatePages links (nearest dates first).
 */
function extractDatePageLinks(
  html: string,
  pageUrl: string,
  maxDatePages: number,
): string[] {
  const seen = new Set<string>();
  const links: string[] = [];
  const re = /href="([^"]+)"/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const cleaned = m[1].replace(/[\s\n\r\t]/g, "");
    try {
      const url = new URL(cleaned, pageUrl);
      if (url.hostname !== "family.by") continue;
      if (!/\/afisha\/\d{4}\/\d{2}\/\d{2}\/$/.test(url.pathname)) continue;
      url.hash = "";
      url.search = "";
      const norm = url.toString();
      if (!seen.has(norm)) {
        seen.add(norm);
        links.push(norm);
      }
    } catch {
      // ignore
    }
  }
  // Sort ascending (nearest date first), take limited slice
  return links.sort().slice(0, maxDatePages);
}

function resolveMaxDatePages(source: ImportSource): number {
  const parserConfig = getParserDefinition(PARSER_KEY)?.config;
  const configuredValue = source.crawlMaxPages ?? parserConfig?.maxDatePages;

  if (typeof configuredValue === "number" && configuredValue > 0) {
    return configuredValue;
  }

  return DEFAULT_MAX_DATE_PAGES;
}

// ── Detail page extraction ────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function indexOfInsensitive(hay: string, needle: string, from: number): number {
  return hay.toLowerCase().indexOf(needle.toLowerCase(), from);
}

/**
 * Конец открывающего тега <div ...> — позиция сразу после `>`.
 * divOpenIdx — индекс символа `<` открывающего div.
 */
function endIndexOfBalancedDiv(html: string, divOpenIdx: number): number {
  const gt = html.indexOf(">", divOpenIdx);
  if (gt === -1) return html.length;
  let depth = 1;
  let i = gt + 1;
  while (depth > 0 && i < html.length) {
    const o = indexOfInsensitive(html, "<div", i);
    const c = indexOfInsensitive(html, "</div>", i);
    if (c === -1) return html.length;
    if (o !== -1 && o < c) {
      depth++;
      i = o + 4;
    } else {
      depth--;
      if (depth === 0) return c + 6;
      i = c + 6;
    }
  }
  return html.length;
}

/** Внутренний HTML контейнера основной новости (DLE: div#news-id-…). */
export function extractNewsIdInnerHtml(html: string): string | null {
  const m = html.match(/<div[^>]*\bid="news-id-\d+"[^>]*>/i);
  if (!m || m.index === undefined) return null;
  const start = m.index;
  const innerEnd = endIndexOfBalancedDiv(html, start);
  const gt = html.indexOf(">", start);
  if (gt === -1 || gt + 1 >= innerEnd - 6) return null;
  return html.slice(gt + 1, innerEnd - 6);
}

const AFISHA_BODY_FOOTER_MARKERS: RegExp[] = [
  /class="title_stype_brn2"/i,
  /Посетители,\s*находящиеся\s+в\s+группе\s+Гости/i,
  /\bid=["']related/i,
  /<h2[^>]*>\s*Информация\s*<\/h2>/i,
];

function truncateHtmlAtSidebarFooter(html: string): string {
  let cut = html.length;
  for (const re of AFISHA_BODY_FOOTER_MARKERS) {
    const m = html.match(re);
    if (m && m.index !== undefined && m.index < cut) cut = m.index;
  }
  return html.slice(0, cut);
}

function removeScriptStyleIframes(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
}

/** Убрать блок «Время проведения» + div.xfpovtor из тела (расписание хранится отдельно). */
function removeScheduleSubsectionFromInner(inner: string): string {
  const m = inner.match(/<(?:b|strong)>\s*Время\s+проведения:\s*<\/(?:b|strong)>/i);
  if (!m || m.index === undefined) return inner;
  const from = m.index;
  const tail = inner.slice(from);
  const divM = tail.match(/<div[^>]*class="[^"]*\bxfpovtor\b[^"]*"[^>]*>/i);
  if (!divM || divM.index === undefined) {
    return inner.slice(0, from) + tail.slice(m[0].length).replace(/^[\s\n\r]*(?:<br\s*\/?>\s*)*/i, "");
  }
  const divStart = from + divM.index;
  const afterBlock = endIndexOfBalancedDiv(inner, divStart);
  return (inner.slice(0, from) + inner.slice(afterBlock)).trim();
}

/**
 * Полный inner HTML блока расписания (div.xfpovtor после «Время проведения:»).
 */
function extractScheduleXfpovtorInnerHtml(html: string): string | null {
  const m = html.match(/<(?:b|strong)>\s*Время\s+проведения:\s*<\/(?:b|strong)>/i);
  if (!m || m.index === undefined) return null;
  const tail = html.slice(m.index + m[0].length);
  const divM = tail.match(/<div[^>]*class="[^"]*\bxfpovtor\b[^"]*"[^>]*>/i);
  if (!divM || divM.index === undefined) return null;
  const divStart = m.index + m[0].length + divM.index;
  const gt = html.indexOf(">", divStart);
  if (gt === -1) return null;
  const innerEnd = endIndexOfBalancedDiv(html, divStart);
  return html.slice(gt + 1, innerEnd - 6);
}

/** Текст расписания: переносы строк между датами, без агрессивного схлопывания в одну строку. */
function scheduleInnerHtmlToRawPlain(inner: string | null): string | null {
  if (!inner) return null;
  let h = inner
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|tr)\s*>/gi, "\n")
    .replace(/<\/(h[1-6])\s*>/gi, "\n\n");
  h = h.replace(/<[^>]+>/g, " ");
  h = h
    .replace(/&nbsp;/gi, " ")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&[a-z]{2,8};/gi, " ");
  const lines = h
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0);
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return text.length > 0 ? text : null;
}

/**
 * Основной текст статьи: абзацы через \n\n, без футера/шеринга.
 */
function htmlArticleToPlain(html: string): string {
  let h = removeScriptStyleIframes(html);
  h = h.replace(/<div[^>]*class="[^"]*(?:addsociales|yashare|share42|usermess)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
  h = h.replace(/<br\s*\/?>/gi, "\n");
  h = h.replace(/<\/(p|div|h[1-6])\s*>/gi, "\n\n");
  h = h.replace(/<li\b[^>]*>/gi, "• ");
  h = h.replace(/<\/li\s*>/gi, "\n");
  h = h.replace(/<[^>]+>/g, " ");
  h = h
    .replace(/&nbsp;/gi, " ")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&[a-z]{2,8};/gi, " ");
  const paras = h
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter((p) => p.length > 0);
  return paras.join("\n\n").trim();
}

function normalizeTitleForDedup(title: string): string {
  return title
    .replace(/\s*[•·]\s*Family\.by\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripLeadingTitleParagraph(plain: string, title: string | null): string {
  if (!title || !plain) return plain;
  const firstPara = plain.split(/\n\s*\n/)[0]?.trim() ?? "";
  if (!firstPara) return plain;
  if (normalizeTitleForDedup(firstPara) === normalizeTitleForDedup(title)) {
    return plain.split(/\n\s*\n/).slice(1).join("\n\n").trim();
  }
  return plain;
}

function deriveSummaryText(fullPlain: string, maxParas = 2): string | null {
  const paras = fullPlain.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return null;
  const s = paras.slice(0, maxParas).join("\n\n").trim();
  return s.length > 0 ? s : null;
}

export function extractAfishaFullDescription(html: string, title: string | null): string | null {
  const inner = extractNewsIdInnerHtml(html);
  if (!inner) return null;
  let work = truncateHtmlAtSidebarFooter(inner);
  work = removeScheduleSubsectionFromInner(work);
  work = removeScriptStyleIframes(work);
  work = work.replace(/<div[^>]*class="[^"]*(?:addsociales|yashare|share42|usermess)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
  let plain = htmlArticleToPlain(work);
  plain = stripLeadingTitleParagraph(plain, title);
  return plain.length > 0 ? plain : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractOgTitle(html: string): string | null {
  const m = html.match(/og:title"\s+content="([^"]+)"/i);
  if (!m) return null;
  return m[1].replace(/\s*[•·]\s*Family\.by\s*$/i, "").trim() || null;
}

/** Ссылки на соцсети из тела новости (href). */
function extractSocialUrlsFromHtmlFragment(html: string | null | undefined): string[] {
  if (!html?.trim()) return [];
  const out: string[] = [];
  const re = /href="(https?:\/\/[^"]+)"/gi;
  const hostRe =
    /instagram\.com|t\.me\/|vk\.com|ok\.ru|facebook\.com|fb\.me|tiktok\.com|youtube\.com|youtu\.be/i;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const url = m[1].replace(/&amp;/g, "&");
    if (!hostRe.test(url)) continue;
    if (/family\.by/i.test(url)) continue;
    if (!out.includes(url)) out.push(url);
    if (out.length >= 12) break;
  }
  return out;
}

/**
 * Extract a labeled field: <b>Label:</b> value — label + colon live *inside* the tag (family.by).
 */
function extractLabeledField(
  html: string,
  label: string,
): { text: string; href: string | null } | null {
  const escaped = escapeRegex(label.replace(/\s*:\s*$/, ""));
  const re = new RegExp(
    `<(?:b|strong)>\\s*${escaped}\\s*:\\s*<\\/(?:b|strong)>\\s*(?:<a[^>]*href="([^"]*)"[^>]*>([\\s\\S]*?)<\\/a>([\\s\\S]{0,1200})|([^<\\n]{1,400}))`,
    "i",
  );
  const m = html.match(re);
  if (!m) return null;

  if (m[1]) {
    const inner = stripTags(m[2] ?? "").replace(/\s+/g, " ").trim();
    const tail = stripTags(m[3] ?? "").replace(/\s+/g, " ").trim();
    const text = `${inner}${tail}`.replace(/\s+/g, " ").trim();
    return text ? { text, href: m[1] } : null;
  }
  const text = (m[4] ?? "").trim();
  return text ? { text, href: null } : null;
}

/** Начало блока «Место:» на family.by (label внутри b/strong). */
const AFISHA_PLACE_LABEL_START =
  /<(?:b|strong)>\s*Место\s*:\s*<\/(?:b|strong)>\s*/i;

const AFISHA_ADDRESS_FRAGMENT_REGEX =
  /((?:ул\.?|улица|пр-т|просп\.?|проспект|пер\.?|переулок|пл\.?|площадь|наб\.?|набережная|шоссе|б-р|бульвар)\s+[^\n.;:]{1,80}?\d[\dA-Za-zА-Яа-яЁё/-]*)/iu;

/** Следующее поле карточки — обрезаем фрагмент до него, чтобы не захватывать лишний HTML. */
const AFISHA_PLACE_BLOCK_END =
  /<(?:b|strong)>\s*(?:Возраст|Стоимость|Телефон|Время\s+проведения)\s*:/i;

/**
 * Нормализация адреса после «Место:»: trim, пробелы, лишние запятые по краям.
 * Внутренние запятые («ул. М.Богдановича, 9А») сохраняются.
 */
export function normalizeAfishaAddressText(raw: string): string | null {
  let s = raw
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/^[,;\s:—–-]+/u, "").replace(/[,;\s:—–-]+$/u, "");
  s = s.replace(/\s*,\s*/g, ", ");
  while (s.includes(", ,")) s = s.replace(/,\s*,/g, ",");
  const clipped = s.match(AFISHA_ADDRESS_FRAGMENT_REGEX)?.[1]?.trim();
  if (clipped) {
    s = clipped.replace(/\s*,\s*/g, ", ");
  }
  return s.length > 0 ? s : null;
}

function splitPlainVenueLine(plain: string): { venueName: string | null; addressText: string | null } {
  const p = plain.replace(/\s+/g, " ").trim();
  if (!p) return { venueName: null, addressText: null };
  const i = p.indexOf(",");
  if (i === -1) return { venueName: p, addressText: null };
  const v = p.slice(0, i).trim().replace(/[,;]+$/u, "") || null;
  const a = normalizeAfishaAddressText(p.slice(i + 1));
  return { venueName: v, addressText: a };
}

/**
 * Детальная страница: блок после «Место:» до следующего поля.
 * Отделяет venueName / addressText: при <a> текст ссылки — название, после </a> — адрес;
 * без ссылки — первая запятая в plain-тексте делит название и адрес (fallback).
 */
export function extractAfishaVenueLocation(
  html: string,
  pageUrl: string = `${BASE_URL}/`,
): {
  venueName: string | null;
  addressText: string | null;
  venueUrl: string | null;
} {
  const startMatch = html.match(AFISHA_PLACE_LABEL_START);
  if (!startMatch || startMatch.index === undefined) {
    return { venueName: null, addressText: null, venueUrl: null };
  }

  const fromLabel = html.slice(startMatch.index + startMatch[0].length);
  const endExec = AFISHA_PLACE_BLOCK_END.exec(fromLabel);
  const fragment = (
    endExec ? fromLabel.slice(0, endExec.index) : fromLabel.slice(0, 2500)
  ).trim();

  if (!fragment) {
    return { venueName: null, addressText: null, venueUrl: null };
  }

  const aRe = /<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i;
  const aMatch = fragment.match(aRe);

  if (aMatch && aMatch.index !== undefined) {
    const hrefRaw = aMatch[1]?.trim() ?? "";
    const venueUrl = hrefRaw ? toAbsoluteFamilyUrl(hrefRaw, pageUrl) : null;

    let venueName =
      stripTags(aMatch[2] ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[,;]+$/u, "")
        .trim() || null;

    const afterAnchorHtml = fragment.slice(aMatch.index + aMatch[0].length);
    let addressText = normalizeAfishaAddressText(stripTags(afterAnchorHtml));

    if (!addressText && venueName?.includes(",")) {
      const split = splitPlainVenueLine(venueName);
      venueName = split.venueName;
      addressText = split.addressText;
    }

    return {
      venueName,
      addressText,
      venueUrl,
    };
  }

  const plain = stripTags(fragment).replace(/\s+/g, " ").trim();
  const { venueName, addressText } = splitPlainVenueLine(plain);
  return { venueName, addressText, venueUrl: null };
}

/**
 * «Время проведения:» — div.xfpovtor целиком (все даты/строки); без схлопывания в одну строку.
 */
export function extractAfishaScheduleRaw(html: string): { raw: string; startAtIso?: string } | null {
  const inner = extractScheduleXfpovtorInnerHtml(html);
  const raw = scheduleInnerHtmlToRawPlain(inner);
  if (raw) {
    const firstLine = raw.split(/\n/)[0]?.replace(/\s+/g, " ").trim() ?? "";
    const startAtIso = firstLine ? parseRussianDayMonthTimeToIsoMinsk(firstLine) : undefined;
    return startAtIso ? { raw, startAtIso } : { raw };
  }

  const loose = html.match(
    /<(?:b|strong)>\s*Время\s+проведения:\s*<\/(?:b|strong)>\s*([^<\n][^<]{0,800}?)(?=<(?:b|strong|div|br)|$)/i,
  );
  if (loose?.[1]) {
    const looseRaw = scheduleInnerHtmlToRawPlain(loose[1]) ?? stripTags(loose[1]).trim();
    if (!looseRaw) return null;
    const firstLine = looseRaw.split(/\n/)[0]?.replace(/\s+/g, " ").trim() ?? "";
    const startAtIso = firstLine ? parseRussianDayMonthTimeToIsoMinsk(firstLine) : undefined;
    return startAtIso ? { raw: looseRaw, startAtIso } : { raw: looseRaw };
  }

  return null;
}

function toAbsoluteFamilyUrl(url: string, pageUrl: string): string | null {
  try {
    const u = new URL(url.trim(), pageUrl);
    if (u.hostname.replace(/^www\./, "") !== "family.by") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function extractOgImage(html: string, pageUrl: string): string | null {
  const m =
    html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i) ??
    html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
  if (!m?.[1]) return null;
  return toAbsoluteFamilyUrl(m[1].trim(), pageUrl);
}

/** Превью из комментария <!--TBegin:https://...jpg|--> */
function extractTBeginPosterUrl(html: string): string | null {
  const m = html.match(/<!--TBegin:\s*(https?:\/\/family\.by\/uploads\/posts\/[^|\s"'<>]+\.(?:jpg|jpeg|png|gif|webp))\s*\|/i);
  return m?.[1]?.trim() ?? null;
}

/** full-size URL из пути с /thumbs/ */
function upgradeFamilyThumbToFullPath(url: string): string {
  return url.replace(/(\/uploads\/posts\/\d{4}-\d{2}\/)thumbs\//i, "$1");
}

/**
 * Афиша: полноразмерное фото из TBegin / href в новости / og:image / img (src|data-src).
 * `newsInnerHtml` — полный inner #news-id-* (предпочтительно), иначе обрезок по старой эвристике.
 */
function extractEventPosterUrls(
  html: string,
  pageUrl: string,
  newsInnerHtml: string | null = null,
): string[] {
  const out: string[] = [];
  const push = (u: string | null | undefined) => {
    if (!u) return;
    let s = u.trim();
    if (s.startsWith("//")) s = `https:${s}`;
    if (s.startsWith("/")) s = `${BASE_URL}${s}`;
    s = upgradeFamilyThumbToFullPath(s);
    const abs = toAbsoluteFamilyUrl(s, pageUrl);
    if (abs && /\/uploads\/posts\//i.test(abs) && !/\/uploads\/posts\/[^/]+\/thumbs\//i.test(abs) && !out.includes(abs)) {
      out.push(abs);
    }
  };

  push(extractTBeginPosterUrl(html));

  const bodySlice =
    newsInnerHtml && newsInnerHtml.trim().length > 0
      ? newsInnerHtml
      : (() => {
          const newsId = html.match(/id="(news-id-\d+)"/i)?.[1];
          return newsId
            ? (html.split(`id="${newsId}"`)[1] ?? "").slice(0, 25_000)
            : html.slice(0, 40_000);
        })();

  const hrefRe = /href="(https?:\/\/family\.by\/uploads\/posts\/[^"]+\.(?:jpg|jpeg|png|gif|webp))"/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hrefRe.exec(bodySlice)) !== null) {
    push(hm[1]);
    if (out.length >= 4) break;
  }

  push(extractOgImage(html, pageUrl));

  const imgAttr = /<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["'][^>]*>/gi;
  while ((hm = imgAttr.exec(bodySlice)) !== null) {
    push(hm[1]);
    if (out.length >= 6) break;
  }

  const legacy = /\/uploads\/posts\/(?!.*thumbs\/)([^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp))/gi;
  while ((hm = legacy.exec(bodySlice)) !== null) {
    push(`${BASE_URL}/uploads/posts/${hm[1]}`);
    if (out.length >= 8) break;
  }

  return out.slice(0, 8);
}

/**
 * Best-effort typeCandidate from title/description keywords.
 * Returns a hint string — NOT mapped to ActivityType enum here.
 */
function inferTypeCandidate(title: string, description: string | null): string {
  const text = (title + " " + (description ?? "")).toLowerCase();
  if (/выставка|экспозиция|экспонат/.test(text)) return "EVENT";
  if (/мастер.?класс|workshop/.test(text)) return "EVENT";
  if (/концерт|спектакль|шоу|представление|перформанс/.test(text)) return "EVENT";
  if (/фестиваль|fest/.test(text)) return "EVENT";
  if (/курс|занятие|обучение|тренинг/.test(text)) return "COURSE";
  return "EVENT"; // default for afisha
}

/**
 * Best-effort scheduleModeCandidate.
 * Returns a hint string — NOT mapped to ScheduleMode enum here.
 */
function inferScheduleModeCandidate(
  description: string | null,
  scheduleText: string | null,
): string | null {
  const text = ((description ?? "") + " " + (scheduleText ?? "")).toLowerCase();
  if (/каждый|ежедневно|ежедневн|еженедельно|регулярно/.test(text)) return "RECURRING";
  if (/апрел|май|июн|июл|август|сентябр|октябр|ноябр|декабр|январ|феврал|март/.test(text)) {
    // Month-long event — likely multi-date
    return "MULTI_DATE";
  }
  return "ONE_TIME"; // default for afisha events
}

// ── Debug types ───────────────────────────────────────────────────────────────

export interface AfishaEventParserDebug {
  listingUrl: string;
  htmlLength: number;
  datePagesFound: number;
  datePagesVisited: number;
  detailLinksFound: number;
  detailPagesVisited: number;
  recordsExtracted: number;
  skippedPages: number;
  warnings: string[];
  sampleDetailLinks: string[];
  sampleRecords: Array<{
    url: string;
    title: string | null;
    startAt: string | null;
    scheduleText: string | null;
    venueName: string | null;
    ageText: string | null;
    priceText: string | null;
    typeCandidate: string;
    scheduleModeCandidate: string | null;
  }>;
}

// ── Main parser ───────────────────────────────────────────────────────────────

export const familyByAfishaEventParser: EventImportParser = {
  parserKey: PARSER_KEY,
  entityType: "EVENT",

  async parse(source: ImportSource): Promise<ParserResult & { debug?: AfishaEventParserDebug }> {
    const listingUrl = source.baseUrl?.trim() || DEFAULT_LISTING_URL;
    const MAX_DETAIL_PAGES = source.crawlMaxDetailLinks ?? source.crawlMaxRecords ?? DEFAULT_MAX_DETAIL_PAGES;
    const maxDatePages = resolveMaxDatePages(source);

    if (!listingUrl.includes("family.by")) {
      return errorParserResult(PARSER_KEY, `Invalid baseUrl: "${listingUrl}". Expected a family.by URL.`);
    }

    const debug: AfishaEventParserDebug = {
      listingUrl,
      htmlLength: 0,
      datePagesFound: 0,
      datePagesVisited: 0,
      detailLinksFound: 0,
      detailPagesVisited: 0,
      recordsExtracted: 0,
      skippedPages: 0,
      warnings: [],
      sampleDetailLinks: [],
      sampleRecords: [],
    };

    // ── Step 1: Load listing page ────────────────────────────────────────
    let listingHtml: string;
    try {
      const response = await fetchHtml(listingUrl, { encoding: "windows-1251", timeoutMs: 12_000, retries: 2 });
      listingHtml = response.html;
      debug.htmlLength = listingHtml.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        records: [], totalFound: 0, parserKey: PARSER_KEY,
        error: `Failed to load listing page ${listingUrl}: ${msg}`,
        debug,
      } as never;
    }

    if (debug.htmlLength < 1000) {
      return {
        records: [], totalFound: 0, parserKey: PARSER_KEY,
        error: `Listing page returned too little content (${debug.htmlLength} bytes). ` +
          `family.by may be blocking the request. Check User-Agent.`,
        debug,
      } as never;
    }

    // ── Step 2: Collect detail links from listing + date sub-pages ───────
    const allDetailLinks = new Set<string>();

    // From main listing page
    for (const link of extractEventDetailLinks(listingHtml, listingUrl)) {
      allDetailLinks.add(link);
    }

    // From date sub-pages
    const datePages = extractDatePageLinks(listingHtml, listingUrl, maxDatePages);
    debug.datePagesFound = datePages.length;

    for (const datePage of datePages) {
      try {
        const { html } = await fetchHtml(datePage, { encoding: "windows-1251", timeoutMs: 12_000, retries: 2 });
        debug.datePagesVisited++;
        for (const link of extractEventDetailLinks(html, datePage)) {
          allDetailLinks.add(link);
        }
        await sleep(DELAY_MS);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debug.warnings.push(`Failed to load date page ${datePage}: ${msg}`);
      }
    }

    const detailLinks = Array.from(allDetailLinks);
    debug.detailLinksFound = detailLinks.length;
    debug.sampleDetailLinks = detailLinks.slice(0, 5);

    if (detailLinks.length === 0) {
      return {
        records: [], totalFound: 0, parserKey: PARSER_KEY,
        error: `No event detail links found on ${listingUrl}. ` +
          `Expected URLs matching /afisha/\\d+-slug.html. ` +
          `HTML length: ${debug.htmlLength}.`,
        debug,
      } as never;
    }

    // ── Step 3: Visit detail pages ───────────────────────────────────────
    const records: ParsedRawRecord[] = [];
    const limit = Math.min(detailLinks.length, MAX_DETAIL_PAGES);

    for (let i = 0; i < limit; i++) {
      const detailUrl = detailLinks[i];

      let html: string;
      try {
        const response = await fetchHtml(detailUrl, { encoding: "windows-1251", timeoutMs: 12_000, retries: 2 });
        html = response.html;
        debug.detailPagesVisited++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debug.warnings.push(`Fetch failed ${detailUrl}: ${msg}`);
        debug.skippedPages++;
        continue;
      }

      const title = extractOgTitle(html);
      if (!title) {
        debug.warnings.push(`No og:title on ${detailUrl} — skipped`);
        debug.skippedPages++;
        continue;
      }

      const newsInnerHtml = extractNewsIdInnerHtml(html);
      const fullDescription = extractAfishaFullDescription(html, title);
      const summaryText = fullDescription ? deriveSummaryText(fullDescription) : null;

      // Venue + address: блок «Место:» до следующего поля; см. extractAfishaVenueLocation
      const placeExtracted = extractAfishaVenueLocation(html, detailUrl);
      let venueName = placeExtracted.venueName;
      let addressText = placeExtracted.addressText;
      if (!venueName && !addressText) {
        const venueField = extractLabeledField(html, "Место");
        if (venueField) {
          const parts = venueField.text.split(",").map((s) => s.trim());
          if (parts.length >= 2) {
            venueName = parts[0] ?? null;
            addressText = parts.slice(1).join(", ");
          } else {
            venueName = venueField.text || null;
          }
          addressText = addressText ? normalizeAfishaAddressText(addressText) : null;
          if (venueName) venueName = venueName.replace(/\s+/g, " ").trim();
        }
      }

      const ageField = extractLabeledField(html, "Возраст");
      const ageText = ageField?.text ?? null;

      const priceField = extractLabeledField(html, "Стоимость");
      const priceText = priceField?.text ?? null;

      const phoneField = extractLabeledField(html, "Телефон");
      const phone = phoneField?.text ?? null;

      const siteField = extractLabeledField(html, "Сайт");
      let website: string | null = null;
      if (siteField?.href?.trim()) {
        website = siteField.href.trim();
      } else if (siteField?.text?.trim()) {
        const t = siteField.text.replace(/\s+/g, " ").trim();
        website = /^https?:\/\//i.test(t) ? t : `https://${t}`;
      }

      const socialUrls = extractSocialUrlsFromHtmlFragment(
        newsInnerHtml && newsInnerHtml.trim().length > 0 ? newsInnerHtml : html,
      );

      const schedule = extractAfishaScheduleRaw(html);
      const scheduleText = schedule?.raw ?? null;
      const startAt = schedule?.startAtIso ?? null;
      const occurrenceLines =
        scheduleText
          ?.split("\n")
          .map((l) => l.replace(/\s+/g, " ").trim())
          .filter(Boolean) ?? [];

      const images = extractEventPosterUrls(html, detailUrl, newsInnerHtml);
      const mainImage = images[0] ?? null;

      // Type / schedule hints
      const typeCandidate = inferTypeCandidate(title, fullDescription);
      const scheduleModeCandidate = inferScheduleModeCandidate(fullDescription, scheduleText);

      // External ID from URL
      const idMatch = detailUrl.match(/\/(\d+)-[^/]+\.html$/);
      const externalId = idMatch ? `family-by-afisha-${idMatch[1]}` : null;

      const rawPayload: Record<string, unknown> = {
        title,
        fullDescription,
        description: fullDescription,
        summaryText,
        mainImage,
        typeCandidate,
        scheduleModeCandidate,
        venueName,
        addressText: addressText ? `${addressText}` : null,
        venueDetailUrl: placeExtracted.venueUrl,
        cityName: "Минск",
        scheduleText,
        ...(occurrenceLines.length > 0 ? { occurrenceLines } : {}),
        startAt,
        ageText,
        priceText,
        organizerName: null,
        phone,
        ...(website ? { website } : {}),
        ...(socialUrls.length > 0 ? { socialUrls } : {}),
        categories: ["афиша", "событие"],
        images,
      };

      records.push({
        externalId,
        sourceUrl: detailUrl,
        canonicalSourceUrl: detailUrl,
        rawPayload,
        sourceUpdatedAt: new Date(),
      });

      debug.recordsExtracted++;

      if (debug.sampleRecords.length < 5) {
        debug.sampleRecords.push({
          url: detailUrl,
          title,
          startAt,
          scheduleText,
          venueName,
          ageText,
          priceText,
          typeCandidate,
          scheduleModeCandidate,
        });
      }

      await sleep(DELAY_MS);
    }

    if (detailLinks.length > MAX_DETAIL_PAGES) {
      debug.warnings.push(
        `Found ${detailLinks.length} detail links, processed first ${MAX_DETAIL_PAGES}.`,
      );
    }

    if (records.length === 0) {
      return {
        records: [], totalFound: 0, parserKey: PARSER_KEY,
        error: `Found ${detailLinks.length} detail links and visited ${debug.detailPagesVisited} pages, ` +
          `but extracted 0 event records. ` +
          `Skipped: ${debug.skippedPages}. ` +
          `Warnings: ${debug.warnings.slice(0, 3).join("; ") || "none"}`,
        debug,
      } as never;
    }

    return {
      records,
      totalFound: records.length,
      parserKey: PARSER_KEY,
      debug,
    } as never;
  },
};
