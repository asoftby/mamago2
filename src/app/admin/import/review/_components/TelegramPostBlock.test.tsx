import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { NormalizedEventImport } from "@/server/modules/import/types";
import { skippedFlags, type TelegramQualityFlags } from "@/server/modules/import/normalizers/telegram-post.mapper";
import { telegramAttentionItems, telegramReviewBadges } from "../../_lib/telegram-review";
import { TelegramPostBlock } from "./TelegramPostBlock";

function flags(over: Partial<TelegramQualityFlags> = {}): TelegramQualityFlags {
  return {
    ...skippedFlags("poll", "EVENT"),
    skipReason: null,
    confidence: { dates: 0.9, venue: 0.9, age: 0.1 },
    fieldStates: { title: "stated", venue: "stated", address: "stated", city: "stated", age: "missing", price: "inferred", dates: "stated" },
    coverNeedsReplacement: true,
    imageRoles: [{ index: 0, role: "POSTER" }],
    ...over,
  };
}

const nd = {
  entityType: "EVENT",
  sourceSlug: "x",
  sourceUrl: "https://t.me/minsk_kids/1",
  title: "Фестиваль Аниме",
  categoryCandidates: [],
  imageUrls: ["https://cdn4.telesco.pe/file/a.jpg"],
  occurrences: [
    { externalId: "c/1#1", startAt: "2026-11-07T15:00:00+03:00", title: "K-pop" },
    { externalId: "c/1#2", startAt: "2026-11-08T15:00:00+03:00" },
  ],
} as NormalizedEventImport;

// ── Badges: only Telegram records get them; other sources' flags are ignored ──
assert.deepEqual(telegramReviewBadges(null), []);
assert.deepEqual(telegramReviewBadges({ multiVenue: true, belowPriceFloor: false, nonMinskCity: false }), [], "ABWS flags: no Telegram badges");
assert.deepEqual(telegramReviewBadges(undefined), []);
{
  const plain = telegramReviewBadges(flags());
  assert.deepEqual(plain.map((b) => b.key), ["telegram"]);

  const rich = telegramReviewBadges(
    flags({
      postKind: "DIGEST",
      hasConflict: true,
      conflicts: [{ field: "occurrences[0].startAt", text: "15:00", image: { index: 0, value: "14:00" } }],
      confidence: { dates: 0.3, venue: 0.4, age: 0.1 },
      sourceChanged: { fields: ["dates"], detectedAt: "2026-10-30T10:00:00Z" },
      pendingDuplicates: [{ recordId: "r2", sourceId: "s2", title: "Фестиваль Аниме", score: 0.8, reason: "x" }],
    }),
  );
  assert.deepEqual(rich.map((b) => b.key), ["telegram", "postKind", "conflict", "lowConfidence", "sourceChanged", "pendingDuplicates"]);
  assert.match(rich.find((b) => b.key === "lowConfidence")!.label, /даты, место/);
  assert.match(rich.find((b) => b.key === "pendingDuplicates")!.label, /1/);
}
// A low age confidence alone is expected (age is usually absent) and is not flagged.
assert.equal(telegramReviewBadges(flags({ confidence: { dates: 0.9, venue: 0.9, age: 0.0 } })).some((b) => b.key === "lowConfidence"), false);

// ── Attention list ───────────────────────────────────────────────────────────
assert.deepEqual(telegramAttentionItems(null), []);
{
  const items = telegramAttentionItems(
    flags({ hasConflict: true, confidence: { dates: 0.2, venue: 0.9, age: 0.1 }, sourceChanged: { fields: ["price"], detectedAt: "x" } }),
  );
  assert.ok(items.some((i) => /афиша расходятся/.test(i)));
  assert.ok(items.some((i) => /датах/.test(i)));
  assert.ok(items.some((i) => /Пост изменился/.test(i)));
  assert.ok(items.some((i) => /Обложка временная/.test(i)));
}

// ── The card block ───────────────────────────────────────────────────────────
{
  const html = renderToStaticMarkup(
    createElement(TelegramPostBlock, {
      flags: flags({
        postKind: "FESTIVAL",
        hasConflict: true,
        conflicts: [{ field: "occurrences[0].startAt", text: "2026-11-07T15:00:00+03:00", image: { index: 0, value: "2026-11-07T14:00:00+03:00" } }],
        confidence: { dates: 0.3, venue: 0.9, age: 0.1 },
        audienceHint: "подростки",
        addressNote: "4 этаж",
        sourceChanged: { fields: ["dates", "skip:past_event"], detectedAt: "2026-10-30T10:00:00Z" },
        pendingDuplicates: [{ recordId: "rec-2", sourceId: "s2", title: "Аниме-фест из ABWS", score: 0.82, reason: "x" }],
      }),
      nd,
      postUrl: "https://t.me/minsk_kids/3743",
    }),
  );
  assert.match(html, /Данные из Telegram · Фестиваль/);
  assert.match(html, /Текст и афиша расходятся/);
  assert.match(html, /2026-11-07T14:00:00\+03:00 \(картинка 1\)/, "the poster value is shown next to the text value");
  assert.match(html, /Сеансы \(2\)/);
  assert.match(html, /K-pop/, "session titles are shown");
  assert.match(html, /7 ноября 2026/, "dates are shown in Minsk time");
  assert.match(html, /проверить/, "low confidence field is marked");
  assert.match(html, /Подсказка по аудитории: подростки/);
  assert.match(html, /К адресу: 4 этаж/);
  assert.match(html, /Пост изменился/);
  assert.match(html, /даты, событие уже прошло/);
  assert.match(html, /href="\/admin\/import\/review\/rec-2"/, "duplicate links to the other pending record");
  assert.match(html, /82%/);
  assert.match(html, /referrerPolicy="no-referrer"|referrerpolicy="no-referrer"/i, "source images are fetched without referrer");
  assert.match(html, /Обложка временная/);
  assert.match(html, /афиша/, "image role is labelled");
  assert.match(html, /href="https:\/\/t\.me\/minsk_kids\/3743"/);
  assert.match(html, /только админка/);
}

// A quiet record shows no alert, no conflict table and no duplicates.
{
  const html = renderToStaticMarkup(createElement(TelegramPostBlock, { flags: flags({ coverNeedsReplacement: false }), nd: { ...nd, occurrences: undefined, imageUrls: [] } as NormalizedEventImport, postUrl: null }));
  assert.doesNotMatch(html, /Пост изменился/);
  assert.doesNotMatch(html, /Текст и афиша расходятся/);
  assert.doesNotMatch(html, /Возможные дубли/);
  assert.doesNotMatch(html, /Сеансы/);
  assert.doesNotMatch(html, /Открыть пост/);
}

console.log("TelegramPostBlock tests: OK");
