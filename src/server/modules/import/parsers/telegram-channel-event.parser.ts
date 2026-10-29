/**
 * telegram-channel-event.parser.ts
 *
 * EVENT-парсер публичного Telegram-канала через веб-версию `t.me/s/<канал>`.
 * parserKey: "telegram-channel-event". Без аккаунта и токенов; только чтение.
 *
 * Делает только сырую выгрузку постов (текст, ссылки, хэштеги, фото). Решение,
 * анонс это или нет, принимает нормализатор постов (отдельный PR), здесь
 * классификации нет.
 *
 * Экономия расходов: `hashInput` собирается из стабильного содержимого поста
 * (текст, ссылки, хэштеги, признаки, sha256 картинок), CDN-адреса в него не
 * входят. Пост с тем же хэшем пайплайн пропускает без вызова модели. Картинки
 * скачиваются только с новыми URL; для известных берётся сохранённый sha256.
 */

import type { ImportSource } from "@prisma/client";

import { createWebImageSource } from "@/server/ai/extraction/images";
import type { EventImportParser } from "./base.parser";
import { errorParserResult } from "./base.parser";
import type { KnownPostImage, ParsedRawRecord, ParserResult, ParserRunContext } from "../types";
import { fetchHtml } from "./fetchHtml";
import {
  TELEGRAM_CHANNEL_PARSER_KEY,
  isTelegramImageHost,
  isTelegramPageHost,
  parseTelegramChannelName,
} from "./telegram-channel-constants";
import { parseChannelPage, type TelegramPost } from "./telegram-channel-html";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGES = 3;
const FIRST_RUN_PAGES = 5;
const MAX_PAGES = 10;
const MAX_POST_AGE_DAYS = 14;
const FIRST_RUN_MAX_POST_AGE_DAYS = 30;
const DEFAULT_RATE_LIMIT_MS = 1_500;
const MAX_IMAGES_PER_POST = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Потолок скачиваний картинок за запуск; остальное добирается следующим запуском. */
const MAX_IMAGE_DOWNLOADS_PER_RUN = 150;
const IMAGE_UNAVAILABLE = "unavailable";

export interface TelegramChannelParserDeps {
  fetchPage?: (url: string) => Promise<string>;
  loadImage?: (url: string) => Promise<{ ok: true; sha256: string } | { ok: false }>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  /** Источник случайности для разброса пауз; в тестах подменяется. */
  random?: () => number;
}

interface PostImage {
  url: string;
  sha256: string | null;
}

function defaultFetchPage(url: string): Promise<string> {
  return fetchHtml(url, {
    timeoutMs: 15_000,
    retries: 2,
    validateUrl: (candidate) => {
      if (candidate.protocol !== "https:" || !isTelegramPageHost(candidate.hostname)) {
        throw new Error("Telegram page host is not allowed");
      }
    },
  }).then((result) => result.html);
}

function defaultLoadImage() {
  const source = createWebImageSource({ maxBytes: MAX_IMAGE_BYTES, isAllowedHost: isTelegramImageHost });
  return async (url: string) => {
    const loaded = await source.load(url);
    return loaded.ok ? ({ ok: true, sha256: loaded.value.sha256 } as const) : ({ ok: false } as const);
  };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHashInput(post: TelegramPost, images: PostImage[]): ParsedRawRecord["hashInput"] {
  const flags = Object.entries(post.flags)
    .filter(([, on]) => on)
    .map(([name]) => name)
    .sort();
  return {
    text: post.text,
    links: post.links.map((link) => `${link.text}\u0000${link.href}`),
    hashtags: post.hashtags,
    flags,
    images: images.map((image) => image.sha256 ?? IMAGE_UNAVAILABLE),
  };
}

export function createTelegramChannelEventParser(deps: TelegramChannelParserDeps = {}): EventImportParser {
  const fetchPage = deps.fetchPage ?? defaultFetchPage;
  const loadImage = deps.loadImage ?? defaultLoadImage();
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? (() => new Date());
  const random = deps.random ?? Math.random;

  return {
    parserKey: TELEGRAM_CHANNEL_PARSER_KEY,
    entityType: "EVENT",

    async parse(source: ImportSource, context?: ParserRunContext): Promise<ParserResult> {
      const channel = parseTelegramChannelName(source.baseUrl);
      if (!channel) {
        return errorParserResult(
          TELEGRAM_CHANNEL_PARSER_KEY,
          "baseUrl must be a public Telegram channel like https://t.me/s/<channel>",
        );
      }

      const firstRun = source.lastRunAt == null;
      const maxPages = Math.min(source.crawlMaxPages ?? (firstRun ? FIRST_RUN_PAGES : DEFAULT_PAGES), MAX_PAGES);
      const cutoff = now().getTime() - (firstRun ? FIRST_RUN_MAX_POST_AGE_DAYS : MAX_POST_AGE_DAYS) * DAY_MS;
      const pauseMs = source.rateLimitMs ?? DEFAULT_RATE_LIMIT_MS;

      // ── Страницы, от новых к старым ──────────────────────────────────────
      const posts: TelegramPost[] = [];
      let before: number | null = null;
      for (let page = 0; page < maxPages; page++) {
        // Пауза с разбросом ±30%: ровный интервал выдаёт скрипт.
        if (page > 0) await sleep(Math.round(pauseMs * (0.7 + random() * 0.6)));
        const url: string = `https://t.me/s/${channel}${before ? `?before=${before}` : ""}`;
        let html: string;
        try {
          html = await fetchPage(url);
        } catch (error) {
          if (page === 0) {
            return errorParserResult(
              TELEGRAM_CHANNEL_PARSER_KEY,
              `Telegram channel page failed: ${error instanceof Error ? error.message : "unknown error"}`,
            );
          }
          break; // страницы глубже недоступны: берём, что успели
        }
        const pagePosts = parseChannelPage(html, channel);
        if (pagePosts.length === 0) {
          if (page === 0) {
            return errorParserResult(TELEGRAM_CHANNEL_PARSER_KEY, "Telegram channel page has no posts (private, empty or renamed channel)");
          }
          break;
        }
        const fresh = pagePosts.filter((post) => !post.postedAt || new Date(post.postedAt).getTime() >= cutoff);
        posts.push(...fresh);
        if (fresh.length < pagePosts.length) break; // дальше только старые посты
        before = Math.min(...pagePosts.map((post) => post.messageId));
      }

      // ── Картинки: известные URL не скачиваем ────────────────────────────
      const known = context ? await context.loadKnownImages(posts.map((post) => `${channel}/${post.messageId}`)) : new Map<string, KnownPostImage[]>();
      let downloads = 0;
      const records: ParsedRawRecord[] = [];

      for (const post of posts) {
        const externalId = `${channel}/${post.messageId}`;
        const knownByUrl = new Map((known.get(externalId) ?? []).map((image) => [image.url, image.sha256]));
        const images: PostImage[] = [];
        for (const url of post.imageUrls.slice(0, MAX_IMAGES_PER_POST)) {
          const cached = knownByUrl.get(url);
          if (cached) {
            images.push({ url, sha256: cached });
            continue;
          }
          if (downloads >= MAX_IMAGE_DOWNLOADS_PER_RUN) {
            images.push({ url, sha256: null });
            continue;
          }
          downloads++;
          const loaded = await loadImage(url);
          images.push({ url, sha256: loaded.ok ? loaded.sha256 : null });
        }

        records.push({
          externalId,
          sourceUrl: post.url,
          canonicalSourceUrl: post.url,
          rawPayload: {
            channel,
            messageId: post.messageId,
            postedAt: post.postedAt,
            text: post.text,
            links: post.links,
            hashtags: post.hashtags,
            flags: post.flags,
            images,
          },
          rawText: post.text,
          sourceUpdatedAt: post.postedAt ? new Date(post.postedAt) : undefined,
          hashInput: buildHashInput(post, images),
        });
      }

      return { records, totalFound: records.length, parserKey: TELEGRAM_CHANNEL_PARSER_KEY };
    },
  };
}

export const telegramChannelEventParser = createTelegramChannelEventParser();
