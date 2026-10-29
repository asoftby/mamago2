/**
 * Оценка качества нормализатора постов Telegram-канала на размеченных фикстурах.
 *
 * Берёт 45 реальных постов minsk_kids и черновую разметку
 * (src/server/modules/import/parsers/__fixtures__/telegram-minsk-kids/labels.json),
 * гоняет те же промпт, схему и политику попыток (быстрая модель, повтор,
 * сильная модель), что и боевой нормализатор, и печатает метрики:
 * классификацию EVENT / FESTIVAL / DIGEST / NOT_EVENT, верность даты, времени,
 * места и цены (только по размеченным полям) и расход токенов на 100 постов.
 *
 * Запуск (нужны ключ и модель OpenRouter, в БД ничего не пишется):
 *   OPENROUTER_API_KEY=... OPENROUTER_CAPTURE_MODEL=... \
 *     pnpm tsx scripts/eval-telegram-post-normalizer.ts [--no-images] [--limit N] [--out report.json]
 *   pnpm tsx scripts/eval-telegram-post-normalizer.ts --dry     # без сети: проверка разметки и запросов
 *
 * Картинки скачиваются с CDN Telegram (адреса из фикстур могли протухнуть).
 * Публикаций нет: это замер.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createOpenRouterClient,
  readCaptureModelConfig,
  type OpenRouterResponseFormat,
} from "@/lib/ai/openrouterClient";
import { createExtractionCall, createWebImageSource, imageToDataUrl, type ExtractionUsage } from "@/server/ai/extraction";
import { parseChannelPage } from "@/server/modules/import/parsers/telegram-channel-html";
import { isTelegramImageHost } from "@/server/modules/import/parsers/telegram-channel-constants";
import {
  buildTelegramPostUserParts,
  dropChannelSelfLinks,
  TELEGRAM_POST_SYSTEM_PROMPT,
} from "@/server/modules/import/normalizers/telegram-post.prompt";
import {
  parseTelegramPostExtraction,
  telegramPostJsonSchema,
  type TelegramPostExtraction,
} from "@/server/modules/import/normalizers/telegram-post.schema";

const FIXTURES = join(process.cwd(), "src/server/modules/import/parsers/__fixtures__/telegram-minsk-kids");

type Label = {
  messageId: number;
  kind: string[];
  start?: string;
  placeContains?: string[];
  price?: "free" | "paid";
};

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

/** ISO с любым смещением -> локальное время Минска (UTC+3) вида YYYY-MM-DDTHH:mm. */
function toMinskLocal(iso: string): string {
  const date = new Date(new Date(iso).getTime() + 3 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

function pct(part: number, total: number): string {
  return total === 0 ? "n/a" : `${((part / total) * 100).toFixed(0)}% (${part}/${total})`;
}

async function main() {
  const labels = (JSON.parse(readFileSync(join(FIXTURES, "labels.json"), "utf8")) as { labels: Label[] }).labels;
  const posts = [1, 2, 3, 4, 5].flatMap((n) =>
    parseChannelPage(readFileSync(join(FIXTURES, `page${n}.html`), "utf8"), "minsk_kids"),
  );
  const labelById = new Map(labels.map((l) => [l.messageId, l]));
  const missing = posts.filter((p) => !labelById.has(p.messageId));
  if (missing.length > 0 || labels.length !== posts.length) {
    throw new Error(`labels do not match fixtures (${labels.length} labels, ${posts.length} posts)`);
  }

  const limit = Number(option("--limit") ?? posts.length);
  const useImages = !flag("--no-images");
  const selected = posts.slice(0, limit);
  const models = readCaptureModelConfig();

  if (flag("--dry")) {
    const sizes = selected.map((p) => buildTelegramPostUserParts({
      postedAt: p.postedAt, text: p.text, links: p.links, hashtags: p.hashtags, cityHint: "Минск", imageDataUrls: [],
    }));
    const chars = sizes.map((parts) => (parts[0] as { text: string }).text.length);
    console.log(`dry run: ${selected.length} posts, labels ok, system prompt ${TELEGRAM_POST_SYSTEM_PROMPT.length} chars, ` +
      `user text avg ${Math.round(chars.reduce((a, b) => a + b, 0) / chars.length)} chars, images: ${selected.reduce((a, p) => a + p.imageUrls.length, 0)}`);
    return;
  }

  if (!models.fast) throw new Error("set OPENROUTER_API_KEY and OPENROUTER_CAPTURE_MODEL (see OPENROUTER_CAPTURE_MODEL_STRONG for escalation)");
  const openrouter = createOpenRouterClient();
  const images = createWebImageSource({ maxBytes: 5 * 1024 * 1024, isAllowedHost: isTelegramImageHost });
  const responseFormat: OpenRouterResponseFormat =
    models.responseFormat === "json_schema"
      ? { type: "json_schema", name: "telegram_post", schema: telegramPostJsonSchema() }
      : { type: "json_object" };

  const total: ExtractionUsage = { tokensIn: 0, tokensOut: 0, model: null };
  let calls = 0;
  let failed = 0;
  let kindStrict = 0;
  let kindLenient = 0;
  const confusion = new Map<string, number>();
  const score = { start: [0, 0], place: [0, 0], price: [0, 0] };
  const rows: unknown[] = [];

  for (const post of selected) {
    const label = labelById.get(post.messageId)!;
    const imageDataUrls: string[] = [];
    if (useImages) {
      for (const url of post.imageUrls.slice(0, 10)) {
        const loaded = await images.load(url);
        if (loaded.ok) imageDataUrls.push(imageToDataUrl(loaded.value));
      }
    }
    const usage: ExtractionUsage = { tokensIn: null, tokensOut: null, model: null };
    const call = createExtractionCall<TelegramPostExtraction>({
      openrouter: { chat: (input) => { calls++; return openrouter.chat(input); } },
      systemPrompt: TELEGRAM_POST_SYSTEM_PROMPT,
      userParts: buildTelegramPostUserParts({
        postedAt: post.postedAt, text: post.text, links: dropChannelSelfLinks(post.links, "minsk_kids"), hashtags: post.hashtags, cityHint: "Минск", imageDataUrls,
      }),
      responseFormat,
      parse: (content) => {
        const parsed = parseTelegramPostExtraction(content);
        return parsed.ok ? { ok: true, value: parsed.value } : { ok: false };
      },
      usage,
    });
    const outcome = await call.runWithRetry({ fast: models.fast, strong: models.strong });
    total.tokensIn! += usage.tokensIn ?? 0;
    total.tokensOut! += usage.tokensOut ?? 0;

    if (!outcome.ok) {
      failed++;
      rows.push({ messageId: post.messageId, error: outcome.reason });
      console.log(`#${post.messageId} FAILED ${outcome.reason}`);
      continue;
    }

    const extraction = outcome.value;
    const kind = extraction.postKind;
    if (kind === label.kind[0]) kindStrict++;
    if (label.kind.includes(kind)) kindLenient++;
    confusion.set(`${label.kind[0]}->${kind}`, (confusion.get(`${label.kind[0]}->${kind}`) ?? 0) + 1);

    const event = extraction.events[0];
    const checks: Record<string, boolean | null> = { start: null, place: null, price: null };
    if (event && kind !== "DIGEST") {
      if (label.start) {
        const first = event.occurrences
          .map((o) => o.startAt.value)
          .filter((v): v is string => Boolean(v))
          .map(toMinskLocal)
          .sort()[0];
        const expected = label.start;
        checks.start = Boolean(first) && (expected.length === 10 ? first!.startsWith(expected) : first === expected);
        score.start[1]++;
        if (checks.start) score.start[0]++;
      }
      if (label.placeContains) {
        const haystack = `${event.venueName.value ?? ""} ${event.addressText.value ?? ""}`.toLowerCase();
        checks.place = label.placeContains.some((s) => haystack.includes(s.toLowerCase()));
        score.place[1]++;
        if (checks.place) score.place[0]++;
      }
      if (label.price) {
        const isFree = event.price.isFree === true;
        checks.price = label.price === "free" ? isFree : !isFree && Boolean(event.price.value);
        score.price[1]++;
        if (checks.price) score.price[0]++;
      }
    }
    rows.push({ messageId: post.messageId, expected: label.kind, kind, ...checks, escalation: outcome.escalation });
    console.log(`#${post.messageId} ${label.kind.join("|")} -> ${kind} start=${checks.start} place=${checks.place} price=${checks.price}`);
  }

  const n = selected.length;
  const per100 = (v: number) => Math.round((v / n) * 100);
  const report = {
    posts: n,
    images: useImages,
    models: { fast: models.fast, strong: models.strong },
    failedPosts: failed,
    kindStrict: pct(kindStrict, n),
    kindLenient: pct(kindLenient, n),
    confusion: Object.fromEntries(confusion),
    startAccuracy: pct(score.start[0], score.start[1]),
    placeAccuracy: pct(score.place[0], score.place[1]),
    priceAccuracy: pct(score.price[0], score.price[1]),
    modelCalls: calls,
    tokensIn: total.tokensIn,
    tokensOut: total.tokensOut,
    tokensPer100Posts: { in: per100(total.tokensIn ?? 0), out: per100(total.tokensOut ?? 0) },
    callsPer100Posts: per100(calls),
    note: "labels are a draft by the agent; unlabeled fields are not scored",
  };
  console.log("\n" + JSON.stringify(report, null, 2));
  const out = option("--out");
  if (out) writeFileSync(out, JSON.stringify({ report, rows }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "eval failed");
  process.exit(1);
});
