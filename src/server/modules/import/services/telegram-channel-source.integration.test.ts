/**
 * Источник Telegram-канала и контекст запуска на реальной БД
 * (гоняется через scripts/git/gate-env.sh на одноразовом Postgres).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import prisma from "@/lib/prisma";
import { getParser, listParserKeys } from "../parsers/registry";
import { getParserDefinition } from "../parsers/parser-definitions";
import { createImportSource } from "./import-source.service";
import { buildParserRunContext } from "./parser-run-context";

const tag = randomUUID().slice(0, 8);
const createdSourceIds: string[] = [];

after(async () => {
  await prisma.importedRecord.deleteMany({ where: { sourceId: { in: createdSourceIds } } });
  await prisma.importSource.deleteMany({ where: { id: { in: createdSourceIds } } });
  await prisma.$disconnect();
});

test("parser is registered and described for the admin form", () => {
  assert.ok(listParserKeys().includes("telegram-channel-event"));
  assert.equal(getParser("telegram-channel-event")?.parserKey, "telegram-channel-event");
  assert.equal(getParserDefinition("telegram-channel-event")?.entityType, "EVENT");
});

test("a channel is added as one ImportSource through the existing form fields", async () => {
  // Форма создания шлёт type WEBSITE и выбранный parserKey; тип, стратегия и сущность выводятся из ключа.
  const source = await createImportSource({
    name: `minsk_kids ${tag}`,
    slug: `minsk-kids-${tag}`,
    type: "WEBSITE",
    parserKey: "telegram-channel-event",
    baseUrl: "https://t.me/s/minsk_kids",
    defaultEntity: "PLACE",
  });
  createdSourceIds.push(source.id);

  assert.equal(source.type, "TELEGRAM_CHANNEL");
  assert.equal(source.fetchStrategy, "TELEGRAM_WEB_PREVIEW");
  assert.equal(source.defaultEntity, "EVENT");
  assert.equal(source.isOrganizerSource, false, "aggregator by default");
  assert.equal(source.isAutoUpdate, false, "no schedule before the pilot");
  assert.equal(source.runIntervalMinutes, 60);
  assert.equal(source.aiCallBudgetPerRun, 60);
});

test("other parsers keep their type, strategy and entity", async () => {
  const source = await createImportSource({
    name: `fam ${tag}`,
    slug: `fam-${tag}`,
    type: "WEBSITE",
    parserKey: "family-by-afisha-event",
    defaultEntity: "EVENT",
  });
  createdSourceIds.push(source.id);
  assert.equal(source.type, "WEBSITE");
  assert.equal(source.fetchStrategy, "HTML_SCRAPE");
});

test("run context returns stored image hashes of this source's posts only", async () => {
  const mine = await createImportSource({ name: `ctx ${tag}`, slug: `ctx-${tag}`, type: "WEBSITE", parserKey: "telegram-channel-event", baseUrl: "https://t.me/s/minsk_kids" });
  const other = await createImportSource({ name: `ctx2 ${tag}`, slug: `ctx2-${tag}`, type: "WEBSITE", parserKey: "telegram-channel-event", baseUrl: "https://t.me/s/minsk_kids" });
  createdSourceIds.push(mine.id, other.id);

  const sha = "a".repeat(64);
  await prisma.importedRecord.create({
    data: {
      sourceId: mine.id,
      externalId: "minsk_kids/1",
      rawPayload: { images: [{ url: "https://cdn4.telesco.pe/file/x.jpg", sha256: sha }, { url: "https://cdn4.telesco.pe/file/y.jpg", sha256: null }] },
    },
  });
  await prisma.importedRecord.create({ data: { sourceId: mine.id, externalId: "minsk_kids/2", rawPayload: { text: "no images" } } });
  await prisma.importedRecord.create({
    data: { sourceId: other.id, externalId: "minsk_kids/1", rawPayload: { images: [{ url: "https://cdn4.telesco.pe/file/z.jpg", sha256: "b".repeat(64) }] } },
  });

  const known = await buildParserRunContext(mine.id).loadKnownImages(["minsk_kids/1", "minsk_kids/2", "minsk_kids/3"]);
  assert.deepEqual([...known.keys()], ["minsk_kids/1"]);
  assert.deepEqual(known.get("minsk_kids/1"), [{ url: "https://cdn4.telesco.pe/file/x.jpg", sha256: sha }], "images without a hash are not reused");
  assert.equal((await buildParserRunContext(mine.id).loadKnownImages([])).size, 0);
});
