/**
 * Дубли среди ожидающих записей других источников (нужна БД; гоняется через
 * scripts/git/gate-env.sh на одноразовом Postgres).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import prisma from "@/lib/prisma";
import type { NormalizedEventImport } from "../types";
import { findPendingRecordDuplicates } from "./pending-record-candidates";

const tag = randomUUID().slice(0, 8);
let sourceA = "";
let sourceB = "";

function event(overrides: Partial<NormalizedEventImport> = {}): NormalizedEventImport {
  return {
    entityType: "EVENT",
    sourceSlug: "x",
    sourceUrl: "https://example.com/x",
    title: "Фестиваль Аниме",
    venueName: "Фудмолл Конкорс",
    addressText: "ул. Бобруйская, 6",
    startAt: "2026-11-07T15:00:00+03:00",
    categoryCandidates: [],
    imageUrls: [],
    ...overrides,
  };
}

async function addRecord(sourceId: string, name: string, data: NormalizedEventImport, over: object = {}) {
  return prisma.importedRecord.create({
    data: {
      sourceId,
      externalId: `${tag}-${name}`,
      entityTypeHint: "EVENT",
      normalizeStatus: "SUCCESS",
      reviewStatus: "PENDING",
      normalizedData: data as unknown as object,
      ...over,
    },
  });
}

before(async () => {
  const a = await prisma.importSource.create({ data: { name: `A ${tag}`, slug: `a-${tag}`, type: "WEBSITE" } });
  const b = await prisma.importSource.create({ data: { name: `B ${tag}`, slug: `b-${tag}`, type: "WEBSITE" } });
  sourceA = a.id;
  sourceB = b.id;
});

after(async () => {
  await prisma.importedRecord.deleteMany({ where: { sourceId: { in: [sourceA, sourceB] } } });
  await prisma.importSource.deleteMany({ where: { id: { in: [sourceA, sourceB] } } });
  await prisma.$disconnect();
});

test("finds the same event pending in another source", async () => {
  const other = await addRecord(sourceB, "same", event({ title: "🎌 Фестиваль Аниме (12+)" }));
  const mine = await addRecord(sourceA, "mine", event());

  const found = await findPendingRecordDuplicates({
    recordId: mine.id,
    sourceId: sourceA,
    normalized: event(),
  });

  const hit = found.find((d) => d.entityId === other.id);
  assert.ok(hit, "pending record of another source must be found");
  assert.equal(hit.entityType, "IMPORTED_RECORD");
  assert.equal(hit.sourceId, sourceB);
  assert.ok(hit.score >= 0.72, `expected strong score, got ${hit.score}`);
  assert.equal(found.some((d) => d.entityId === mine.id), false, "own source is never a candidate");
});

test("ignores other days, other titles, resolved and published records", async () => {
  const otherDay = await addRecord(sourceB, "day", event({ startAt: "2026-12-20T15:00:00+03:00" }));
  const otherTitle = await addRecord(sourceB, "title", event({ title: "Кукольный театр Теремок" }));
  const approved = await addRecord(sourceB, "approved", event(), { reviewStatus: "APPROVED" });

  const found = await findPendingRecordDuplicates({ recordId: "self", sourceId: sourceA, normalized: event() });
  const ids = new Set(found.map((d) => d.entityId));
  assert.equal(ids.has(otherDay.id), false);
  assert.equal(ids.has(otherTitle.id), false);
  assert.equal(ids.has(approved.id), false);
});

test("returns nothing without title or dates", async () => {
  assert.deepEqual(
    await findPendingRecordDuplicates({ recordId: "x", sourceId: sourceA, normalized: event({ startAt: undefined }) }),
    [],
  );
});
