import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ImportSource } from "@prisma/client";
import { computeContentHash } from "../utils/content-hash";
import type { KnownPostImage, ParserRunContext } from "../types";
import {
  isTelegramImageHost,
  parseTelegramChannelName,
} from "./telegram-channel-constants";
import { parseChannelPage } from "./telegram-channel-html";
import { createTelegramChannelEventParser } from "./telegram-channel-event.parser";

const FIXTURE_DIR = join(process.cwd(), "src/server/modules/import/parsers/__fixtures__/telegram-minsk-kids");
const pages = [1, 2, 3, 4, 5].map((n) => readFileSync(join(FIXTURE_DIR, `page${n}.html`), "utf8"));

/** Страница N по адресу `?before=` отдаёт следующий фикстурный файл. */
function servePages(transform: (html: string) => string = (html) => html) {
  const requested: string[] = [];
  return {
    requested,
    fetchPage: async (url: string) => {
      requested.push(url);
      return transform(pages[Math.min(requested.length - 1, pages.length - 1)]);
    },
  };
}

function source(overrides: Partial<ImportSource> = {}): ImportSource {
  return {
    id: "src-1",
    baseUrl: "https://t.me/s/minsk_kids",
    lastRunAt: new Date("2026-10-29T00:00:00Z"),
    crawlMaxPages: 2,
    rateLimitMs: 0,
    ...overrides,
  } as ImportSource;
}

const fakeSha = (url: string) => createHash("sha256").update(new URL(url).pathname).digest("hex");
const okImage = async (url: string) => ({ ok: true as const, sha256: fakeSha(url) });
const noSleep = async () => {};
const NOW = () => new Date("2026-10-30T12:00:00Z");

async function main() {
  // ── Constants ────────────────────────────────────────────────────────────
  assert.equal(parseTelegramChannelName("https://t.me/s/minsk_kids"), "minsk_kids");
  assert.equal(parseTelegramChannelName("https://t.me/minsk_kids"), "minsk_kids");
  assert.equal(parseTelegramChannelName("http://t.me/s/minsk_kids"), null, "https only");
  assert.equal(parseTelegramChannelName("https://evil.example/s/minsk_kids"), null);
  assert.equal(parseTelegramChannelName("https://t.me/s/ab"), null, "too short");
  assert.equal(parseTelegramChannelName("https://t.me/s/bad-name-here"), null);
  assert.equal(parseTelegramChannelName(null), null);
  assert.equal(isTelegramImageHost("cdn4.telesco.pe"), true);
  assert.equal(isTelegramImageHost("telesco.pe.evil.example"), false);
  assert.equal(isTelegramImageHost("169.254.169.254"), false);

  // ── Real fixtures: 45 posts of t.me/s/minsk_kids ─────────────────────────
  const all = pages.flatMap((html) => parseChannelPage(html, "minsk_kids"));
  assert.equal(all.length, 45);
  assert.equal(new Set(all.map((p) => p.messageId)).size, 45, "message ids are unique");
  assert.ok(all.every((p) => p.postedAt && p.text.length > 0), "every real post has a date and text");
  assert.ok(all.filter((p) => p.imageUrls.length > 0).length >= 30);
  assert.ok(all.some((p) => p.imageUrls.length >= 7), "an album keeps all its photos");
  assert.ok(all.every((p) => p.imageUrls.every((u) => u.startsWith("https://"))));
  assert.ok(all.every((p) => p.links.every((l) => !/[?&]q=%23/.test(l.href))), "hashtag anchors are not links");
  const first = all.find((p) => p.messageId === 3797);
  assert.ok(first);
  assert.equal(first.postedAt, "2026-10-28T10:02:58+00:00");
  assert.match(first.text, /Выставка АрхНовация/);
  assert.ok(first.hashtags.includes("#минск_ленинский"));
  assert.equal(first.url, "https://t.me/minsk_kids/3797");

  // ── Synthetic markup (real class names): poll / forwarded / ad / video ───
  const synthetic = (extra: string, text = "Текст") =>
    `<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="minsk_kids/9001">${extra}` +
    `<div class="tgme_widget_message_text js-message_text" dir="auto">${text}</div>` +
    `<a class="tgme_widget_message_date" href="https://t.me/minsk_kids/9001"><time datetime="2026-10-29T10:00:00+00:00">10:00</time></a></div></div>`;
  assert.equal(parseChannelPage(synthetic('<div class="tgme_widget_message_poll"></div>'), "minsk_kids")[0].flags.poll, true);
  assert.equal(parseChannelPage(synthetic('<div class="tgme_widget_message_forwarded_from"></div>'), "minsk_kids")[0].flags.forwarded, true);
  assert.equal(parseChannelPage(synthetic("", "Скидка! #реклама erid: 2Vtzq"), "minsk_kids")[0].flags.advertisement, true);
  assert.equal(parseChannelPage(synthetic('<div class="tgme_widget_message_video_wrap"></div>'), "minsk_kids")[0].flags.video, true);
  const plain = parseChannelPage(synthetic(""), "minsk_kids")[0];
  assert.deepEqual(plain.flags, { poll: false, forwarded: false, advertisement: false, video: false });
  assert.equal(parseChannelPage(synthetic("", "A&amp;B &#8212; &lt;c&gt;<br/>строка2"), "minsk_kids")[0].text, "A&B — <c>\nстрока2");
  assert.deepEqual(parseChannelPage(synthetic("", "x"), "other_chan"), [], "posts of another channel are ignored");

  // ── Parser: paging, ids, payload ─────────────────────────────────────────
  {
    const served = servePages();
    const parser = createTelegramChannelEventParser({ fetchPage: served.fetchPage, loadImage: okImage, sleep: noSleep, now: NOW });
    const result = await parser.parse(source());
    assert.equal(result.error, undefined);
    assert.equal(result.records.length, 21, "pages 1+2 = 10+11 posts");
    assert.equal(served.requested.length, 2);
    assert.equal(served.requested[0], "https://t.me/s/minsk_kids");
    const oldestOnPage1 = Math.min(...parseChannelPage(pages[0], "minsk_kids").map((p) => p.messageId));
    assert.equal(served.requested[1], `https://t.me/s/minsk_kids?before=${oldestOnPage1}`);
    const record = result.records.find((r) => r.externalId === "minsk_kids/3797");
    assert.ok(record);
    assert.equal(record.sourceUrl, "https://t.me/minsk_kids/3797");
    assert.equal(record.rawPayload.channel, "minsk_kids");
    assert.equal((record.rawPayload.images as { sha256: string | null }[])[0].sha256?.length, 64);
    assert.ok(record.hashInput && Array.isArray(record.hashInput.images));
  }

  // ── Posts older than the window are dropped ──────────────────────────────
  {
    const parser = createTelegramChannelEventParser({
      fetchPage: servePages().fetchPage,
      loadImage: okImage,
      sleep: noSleep,
      now: () => new Date("2026-12-31T00:00:00Z"),
    });
    const result = await parser.parse(source());
    assert.equal(result.records.length, 0);
    assert.equal(result.error, undefined);
  }

  // ── Same posts again: identical content hashes ───────────────────────────
  const hashes = async (transform?: (html: string) => string, context?: ParserRunContext, load = okImage) => {
    const parser = createTelegramChannelEventParser({
      fetchPage: servePages(transform).fetchPage,
      loadImage: load,
      sleep: noSleep,
      now: NOW,
    });
    const result = await parser.parse(source(), context);
    return new Map(result.records.map((r) => [r.externalId!, computeContentHash(r.hashInput)]));
  };
  const baseline = await hashes();
  assert.deepEqual([...(await hashes())], [...baseline], "re-run without changes: same hashes, nothing new");

  // CDN host/path rotation with identical bytes: hash does not change.
  const rotated = await hashes(
    (html) => html.replace(/https:\/\/cdn4\.telesco\.pe\/file\//g, "https://cdn5.telesco.pe/file/"),
    undefined,
    async (url) => ({ ok: true as const, sha256: fakeSha(url.replace("cdn5", "cdn4")) }),
  );
  assert.deepEqual([...rotated], [...baseline], "CDN address change alone must not change the post hash");

  // Edited text changes exactly that post.
  const edited = await hashes((html) => html.replace("Выставка АрхНовация", "Выставка АрхНовация (перенос)"));
  const changed = [...baseline].filter(([id, hash]) => edited.get(id) !== hash).map(([id]) => id);
  assert.deepEqual(changed, ["minsk_kids/3797"]);

  // Different image bytes change the hash.
  const swapped = await hashes(undefined, undefined, async (url) => ({ ok: true as const, sha256: fakeSha(url + "-new") }));
  assert.ok([...baseline].some(([id, hash]) => swapped.get(id) !== hash), "new image bytes change the hash");

  // ── Known images are not downloaded again ────────────────────────────────
  {
    const knownByPost = new Map<string, KnownPostImage[]>();
    const first = await createTelegramChannelEventParser({
      fetchPage: servePages().fetchPage, loadImage: okImage, sleep: noSleep, now: NOW,
    }).parse(source());
    for (const record of first.records) {
      knownByPost.set(
        record.externalId!,
        (record.rawPayload.images as { url: string; sha256: string }[]).map(({ url, sha256 }) => ({ url, sha256 })),
      );
    }
    let downloads = 0;
    const second = await createTelegramChannelEventParser({
      fetchPage: servePages().fetchPage,
      loadImage: async (url) => { downloads++; return okImage(url); },
      sleep: noSleep,
      now: NOW,
    }).parse(source(), { loadKnownImages: async () => knownByPost });
    assert.equal(downloads, 0, "all image URLs were already known: no downloads");
    assert.deepEqual(
      second.records.map((r) => computeContentHash(r.hashInput)),
      first.records.map((r) => computeContentHash(r.hashInput)),
    );
  }

  // ── Failed image download: stable marker, retried on the next run ────────
  {
    const result = await createTelegramChannelEventParser({
      fetchPage: servePages().fetchPage, loadImage: async () => ({ ok: false }), sleep: noSleep, now: NOW,
    }).parse(source());
    const withImages = result.records.find((r) => (r.rawPayload.images as unknown[]).length > 0)!;
    assert.ok((withImages.rawPayload.images as { sha256: string | null }[]).every((i) => i.sha256 === null));
    assert.ok((withImages.hashInput!.images as string[]).every((i) => i === "unavailable"));
  }

  // ── Errors ───────────────────────────────────────────────────────────────
  {
    const parser = createTelegramChannelEventParser({ fetchPage: servePages().fetchPage, loadImage: okImage, sleep: noSleep, now: NOW });
    assert.match((await parser.parse(source({ baseUrl: "https://example.com/s/minsk_kids" }))).error ?? "", /public Telegram channel/);

    const failing = createTelegramChannelEventParser({
      fetchPage: async () => { throw new Error("HTTP 500"); }, loadImage: okImage, sleep: noSleep, now: NOW,
    });
    const failed = await failing.parse(source());
    assert.match(failed.error ?? "", /page failed/);
    assert.equal(failed.records.length, 0);

    const empty = createTelegramChannelEventParser({
      fetchPage: async () => "<html></html>", loadImage: okImage, sleep: noSleep, now: NOW,
    });
    assert.match((await empty.parse(source())).error ?? "", /no posts/);

    // A later page failing keeps what was already read.
    let calls = 0;
    const partial = createTelegramChannelEventParser({
      fetchPage: async () => { if (calls++ > 0) throw new Error("boom"); return pages[0]; },
      loadImage: okImage, sleep: noSleep, now: NOW,
    });
    const partialResult = await partial.parse(source());
    assert.equal(partialResult.records.length, 10);
    assert.equal(partialResult.error, undefined);
  }

  console.log("telegram-channel-event parser tests: OK");
}

void main();
