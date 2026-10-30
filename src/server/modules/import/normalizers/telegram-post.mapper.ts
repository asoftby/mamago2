/**
 * Ответ модели по посту -> NormalizedEventImport[] (чистые функции, без сети и БД).
 *
 *   EVENT / FESTIVAL : одна запись; у фестиваля подсобытия по дням в occurrences[]
 *   DIGEST           : по записи на каждое событие подборки (`<канал>/<id>#<n>`)
 *   NOT_EVENT        : записей нет
 *
 * Автоотсев события (запись не попадает в очередь, причина в qualityFlags):
 *   past_event, incomplete, out_of_territory.
 */

import type { EventImportOccurrence, NormalizedEventImport } from "../types";
import type { PostKind, TelegramEventExtraction, TelegramPostExtraction } from "./telegram-post.schema";

export type TelegramSkipReason =
  | "poll"
  | "empty_post"
  | "not_event"
  | "digest_split"
  | "past_event"
  | "incomplete"
  | "out_of_territory";

export interface TelegramConflict {
  field: string;
  text: string | null;
  image: { index: number; value: string | null } | null;
}

/** Возможный дубль среди ещё не разобранных записей другого источника. */
export interface PendingDuplicateRef {
  recordId: string;
  sourceId: string;
  title: string;
  score: number;
  reason: string;
}

export interface TelegramSourceChange {
  /** Какие ключевые поля изменились относительно прежней нормализации. */
  fields: string[];
  detectedAt: string;
}

/** Ключи qualityFlags для записей Telegram: заполняются всегда и все. */
export interface TelegramQualityFlags {
  source: "telegram";
  postKind: PostKind | null;
  skipReason: TelegramSkipReason | null;
  confidence: { dates: number; venue: number; age: number } | null;
  conflicts: TelegramConflict[];
  hasConflict: boolean;
  audienceHint: string | null;
  sourceChanged: TelegramSourceChange | null;
  coverNeedsReplacement: boolean;
  addressNote: string | null;
  imageRoles: { index: number; role: "POSTER" | "PHOTO" | "OTHER" }[];
  fieldStates: Record<string, "stated" | "inferred" | "missing">;
  /** Заполняется матчингом: дубли среди ожидающих записей других источников. */
  pendingDuplicates?: PendingDuplicateRef[];
}

export interface TelegramPostContext {
  sourceSlug: string;
  /** `<канал>/<id>` */
  externalId: string;
  sourceUrl: string;
  postedAt: string | null;
  text: string;
  links: { text: string; href: string }[];
  images: { url: string; sha256: string | null }[];
  /** Название города территории источника (только если территория это город). */
  territoryCityName: string | null;
  now: Date;
}

export interface MappedTelegramEvent {
  /** Порядковый номер в подборке (с 1); у одиночного события 1. */
  index: number;
  externalId: string;
  normalized: NormalizedEventImport;
  qualityFlags: TelegramQualityFlags;
  skipReason: TelegramSkipReason | null;
}

const SHORT_DESC_MAX = 200;

function clean(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function stateOf(field: { value: string | null; state: "stated" | "inferred" | "missing" }) {
  return field.value ? field.state : ("missing" as const);
}

/** Ссылка допустима, только если она есть в посте: ссылки не конструируются. */
function allowedUrl(url: string | null | undefined, ctx: TelegramPostContext): string | undefined {
  const value = clean(url);
  if (!value || !/^https?:\/\//i.test(value)) return undefined;
  const bare = value.replace(/\/+$/, "");
  const inLinks = ctx.links.some((link) => link.href.replace(/\/+$/, "") === bare);
  return inLinks || ctx.text.includes(bare) ? value : undefined;
}

function isSocialUrl(url: string): boolean {
  return /^(https?:\/\/)?([a-z0-9-]+\.)*(instagram\.com|vk\.com|t\.me|facebook\.com|youtube\.com|tiktok\.com)\//i.test(url);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 80 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Город территории: сравнение по основе, чтобы «Минск» совпал с «Минске». */
export function sameCity(a: string, b: string): boolean {
  const norm = (value: string) => value.toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]/g, "");
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return true;
  const stem = Math.min(4, x.length, y.length);
  return x.slice(0, stem) === y.slice(0, stem);
}

function pickMainImage(
  ctx: TelegramPostContext,
  roles: TelegramPostExtraction["images"],
): string | undefined {
  const roleOf = (index: number) => roles.find((r) => r.index === index)?.role;
  const photo = ctx.images.findIndex((_, i) => roleOf(i) === "PHOTO");
  const pick = photo >= 0 ? photo : 0;
  return ctx.images[pick]?.url;
}

function mapEvent(
  event: TelegramEventExtraction,
  index: number,
  total: number,
  extraction: TelegramPostExtraction,
  ctx: TelegramPostContext,
): MappedTelegramEvent {
  const isChild = extraction.postKind === "DIGEST";
  const externalId = isChild ? `${ctx.externalId}#${index}` : ctx.externalId;

  const validOccurrences = event.occurrences
    .map((occurrence, i) => ({ occurrence, i }))
    .filter(({ occurrence }) => occurrence.startAt.value && !Number.isNaN(new Date(occurrence.startAt.value).getTime()))
    .sort((a, b) => new Date(a.occurrence.startAt.value!).getTime() - new Date(b.occurrence.startAt.value!).getTime());

  const venueName = clean(event.venueName.value);
  const addressText = clean(event.addressText.value);
  const cityName = clean(event.cityName.value);

  const occurrences: EventImportOccurrence[] = validOccurrences.map(({ occurrence }, n) => ({
    externalId: isChild ? `${externalId}.${n + 1}` : `${externalId}#${n + 1}`,
    startAt: occurrence.startAt.value!,
    venueName,
    addressText,
    cityName,
    ...(clean(occurrence.title) ? { title: clean(occurrence.title)! } : {}),
  }));

  const price = event.price;
  const priceText = clean(price.value) ?? (price.isFree ? "Бесплатно" : undefined);
  const ageText = event.ageText.value && event.ageText.state !== "missing" ? clean(event.ageText.value) : undefined;
  const summary = clean(event.summary);

  const registrationUrl = allowedUrl(event.registration.url, ctx);
  const ticketsUrl = allowedUrl(event.ticketsUrl, ctx);
  const socialUrls = [...new Set(
    [...event.socialUrls.map((url) => allowedUrl(url, ctx)), registrationUrl].filter(
      (url): url is string => Boolean(url) && isSocialUrl(url as string),
    ),
  )];
  const website = registrationUrl && !isSocialUrl(registrationUrl) ? registrationUrl : undefined;

  const mainImageUrl = pickMainImage(ctx, extraction.images);

  const normalized: NormalizedEventImport = {
    entityType: "EVENT",
    sourceSlug: ctx.sourceSlug,
    externalId,
    sourceUrl: ctx.sourceUrl,
    ...(ctx.postedAt ? { sourceUpdatedAt: new Date(ctx.postedAt) } : {}),
    lang: "ru",
    title: clean(event.title.value),
    ...(summary ? { shortDescCandidate: truncate(summary, SHORT_DESC_MAX), description: summary } : {}),
    typeCandidate: "EVENT",
    scheduleModeCandidate: occurrences.length > 1 ? "MULTI_DATE" : "ONE_TIME",
    venueName,
    addressText,
    cityName,
    startAt: occurrences[0]?.startAt,
    ageText,
    priceText,
    categoryCandidates: event.categoryCandidates.map((c) => c.trim()).filter(Boolean),
    ...(mainImageUrl ? { mainImageUrl } : {}),
    imageUrls: ctx.images.map((image) => image.url),
    ...(website ? { website } : {}),
    ...(socialUrls.length > 0 ? { socialUrls } : {}),
    ...(occurrences.length > 0 ? { occurrences } : {}),
    ...(ticketsUrl ? { performanceBuyUrl: ticketsUrl } : {}),
  };

  // ── Автоотсев ──────────────────────────────────────────────────────────────
  let skipReason: TelegramSkipReason | null = null;
  if (!normalized.title || occurrences.length === 0) skipReason = "incomplete";
  else if (occurrences.every((o) => new Date(o.startAt!).getTime() < ctx.now.getTime())) skipReason = "past_event";
  else if (ctx.territoryCityName && cityName && !sameCity(ctx.territoryCityName, cityName)) skipReason = "out_of_territory";

  const conflicts: TelegramConflict[] = event.conflicts.map((c) => ({ field: c.field, text: c.text, image: c.image }));

  const qualityFlags: TelegramQualityFlags = {
    source: "telegram",
    postKind: extraction.postKind,
    skipReason,
    confidence: event.confidence,
    conflicts,
    hasConflict: conflicts.length > 0,
    audienceHint: clean(event.audienceHint) ?? null,
    sourceChanged: null,
    coverNeedsReplacement: ctx.images.length > 0,
    addressNote: clean(event.addressNote) ?? null,
    imageRoles: extraction.images,
    fieldStates: {
      title: stateOf(event.title),
      venue: stateOf(event.venueName),
      address: stateOf(event.addressText),
      city: stateOf(event.cityName),
      age: stateOf(event.ageText),
      price: stateOf(price),
      dates: validOccurrences[0] ? validOccurrences[0].occurrence.startAt.state : "missing",
    },
  };

  void total;
  return { index, externalId, normalized, qualityFlags, skipReason };
}

export function mapTelegramExtraction(
  extraction: TelegramPostExtraction,
  ctx: TelegramPostContext,
): { postKind: PostKind; events: MappedTelegramEvent[] } {
  const total = extraction.events.length;
  return {
    postKind: extraction.postKind,
    events: extraction.events.map((event, i) => mapEvent(event, i + 1, total, extraction, ctx)),
  };
}

/** Флаги для записи, которая не дошла до модели или не является событием. */
export function skippedFlags(
  skipReason: TelegramSkipReason,
  postKind: PostKind | null,
  extra: Partial<TelegramQualityFlags> = {},
): TelegramQualityFlags {
  return {
    source: "telegram",
    postKind,
    skipReason,
    confidence: null,
    conflicts: [],
    hasConflict: false,
    audienceHint: null,
    sourceChanged: null,
    coverNeedsReplacement: false,
    addressNote: null,
    imageRoles: [],
    fieldStates: {},
    ...extra,
  };
}

/** Какие ключевые поля изменились между двумя нормализациями (для sourceChanged). */
export function diffKeyFields(
  before: NormalizedEventImport | null | undefined,
  after: NormalizedEventImport,
): string[] {
  if (!before) return [];
  const starts = (n: NormalizedEventImport) =>
    (n.occurrences ?? []).map((o) => o.startAt).join("|") || n.startAt || "";
  const checks: [string, string, string][] = [
    ["dates", starts(before), starts(after)],
    ["venue", before.venueName ?? "", after.venueName ?? ""],
    ["address", before.addressText ?? "", after.addressText ?? ""],
    ["price", before.priceText ?? "", after.priceText ?? ""],
    ["title", before.title ?? "", after.title ?? ""],
  ];
  return checks.filter(([, a, b]) => a !== b).map(([name]) => name);
}

/** Флаги записи Telegram-канала (по ключу `source`), иначе null. */
export function asTelegramFlags(value: unknown): TelegramQualityFlags | null {
  return value && typeof value === "object" && (value as { source?: unknown }).source === "telegram"
    ? (value as TelegramQualityFlags)
    : null;
}

/** Дубли, найденные матчингом, кладём в флаги записи; пустой список снимает прежние. */
export function mergePendingDuplicates(
  flags: TelegramQualityFlags,
  duplicates: { entityId: string; sourceId: string; entityTitle: string; score: number; reason: string }[],
): TelegramQualityFlags {
  const { pendingDuplicates: _previous, ...rest } = flags;
  void _previous;
  return duplicates.length === 0
    ? rest
    : {
        ...rest,
        pendingDuplicates: duplicates.map((d) => ({
          recordId: d.entityId,
          sourceId: d.sourceId,
          title: d.entityTitle,
          score: d.score,
          reason: d.reason,
        })),
      };
}
