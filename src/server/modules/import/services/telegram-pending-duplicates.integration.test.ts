/**
 * Дубли среди ожидающих записей сохраняются в флагах записи Telegram и только
 * в них (нужна БД; гоняется через scripts/git/gate-env.sh).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import prisma from "@/lib/prisma";
import { matchRecord } from "./import-matching.service";
import { ensureImportReviewTaskExists } from "./import-review-task.service";
import { skippedFlags } from "../normalizers/telegram-post.mapper";

const tag = randomUUID().slice(0, 8);
let tgSource = "";
let otherSource = "";

const normalized = (title: string) => ({
  entityType: "EVENT", sourceSlug: "x", sourceUrl: "https://example.org/e", title,
  venueName: "Фудмолл Конкорс", addressText: "ул. Бобруйская, 6", startAt: "2026-11-07T15:00:00+03:00",
  categoryCandidates: [], imageUrls: [],
});

async function record(sourceId: string, externalId: string, title: string, qualityFlags?: object) {
  const r = await prisma.importedRecord.create({
    data: {
      sourceId, externalId, entityTypeHint: "EVENT", normalizeStatus: "SUCCESS", parseStatus: "SUCCESS",
      normalizedData: normalized(title), qualityScore: 0.8, ...(qualityFlags ? { qualityFlags } : {}),
    },
  });
  await ensureImportReviewTaskExists(r.id);
  return r;
}

before(async () => {
  tgSource = (await prisma.importSource.create({ data: { name: `tg ${tag}`, slug: `tg-pd-${tag}`, type: "TELEGRAM_CHANNEL", fetchStrategy: "TELEGRAM_WEB_PREVIEW", parserKey: "telegram-channel-event", defaultEntity: "EVENT" } })).id;
  otherSource = (await prisma.importSource.create({ data: { name: `ot ${tag}`, slug: `ot-pd-${tag}`, type: "WEBSITE", parserKey: "abws-performances-event", defaultEntity: "EVENT" } })).id;
});

after(async () => {
  await prisma.importedRecord.deleteMany({ where: { sourceId: { in: [tgSource, otherSource] } } });
  await prisma.importSource.deleteMany({ where: { id: { in: [tgSource, otherSource] } } });
  await prisma.$disconnect();
});

test("a Telegram record gets its pending duplicates in qualityFlags; the other source's flags are untouched", async () => {
  const abwsFlags = { multiVenue: false, belowPriceFloor: false, nonMinskCity: false };
  const other = await record(otherSource, `abws-${tag}`, "Фестиваль Аниме", abwsFlags);
  const tg = await record(tgSource, `chan_${tag}/1`, "🎌 Фестиваль Аниме (12+)", skippedFlags("poll", "EVENT"));

  assert.equal((await matchRecord(tg.id)).success, true);
  const tgAfter = await prisma.importedRecord.findUniqueOrThrow({ where: { id: tg.id } });
  const flags = tgAfter.qualityFlags as { source: string; pendingDuplicates?: { recordId: string; title: string; score: number }[] };
  assert.equal(flags.source, "telegram", "existing Telegram flags are preserved");
  assert.equal(flags.pendingDuplicates?.length, 1);
  assert.equal(flags.pendingDuplicates?.[0].recordId, other.id);
  assert.equal(flags.pendingDuplicates?.[0].title, "Фестиваль Аниме");
  assert.ok((flags.pendingDuplicates?.[0].score ?? 0) >= 0.7);

  // The ABWS-style record is matched too, but its flags never gain keys (statistics depend on them).
  assert.equal((await matchRecord(other.id)).success, true);
  const otherAfter = await prisma.importedRecord.findUniqueOrThrow({ where: { id: other.id } });
  assert.deepEqual(otherAfter.qualityFlags, abwsFlags);

  // Once the other record is resolved, the stale hint is removed on the next match.
  await prisma.importedRecord.update({ where: { id: other.id }, data: { reviewStatus: "APPROVED" } });
  await matchRecord(tg.id);
  const cleared = (await prisma.importedRecord.findUniqueOrThrow({ where: { id: tg.id } })).qualityFlags as { source: string; pendingDuplicates?: unknown };
  assert.equal(cleared.source, "telegram");
  assert.equal(cleared.pendingDuplicates, undefined);
});

test("a record with no flags (not from Telegram) is left alone", async () => {
  const plain = await record(otherSource, `plain-${tag}`, "Кукольный театр");
  await matchRecord(plain.id);
  assert.equal((await prisma.importedRecord.findUniqueOrThrow({ where: { id: plain.id } })).qualityFlags, null);
});
