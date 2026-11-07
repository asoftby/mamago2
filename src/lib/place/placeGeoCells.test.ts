import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { geoCellsFor } from "@/lib/geo/geoCell";
import { extendPrismaWithPlaceGeoCells } from "./placeGeoCellExtension";
import { inspectPlaceCoordinateWrite, resolvePlaceGeoCellPatch } from "./placeGeoCells";

const expected = geoCellsFor(53.9006, 27.559)!;

// --- pure helpers ---
assert.equal(resolvePlaceGeoCellPatch({ title: "x" }), null, "no coordinates -> untouched");
assert.deepEqual(resolvePlaceGeoCellPatch({ lat: 53.9006, lng: 27.559 }), expected);
assert.deepEqual(resolvePlaceGeoCellPatch({ lat: { set: 53.9006 }, lng: { set: 27.559 } }), expected);
assert.deepEqual(resolvePlaceGeoCellPatch({ lat: null, lng: null }), { geoCell6: null, geoCell5: null }, "cleared coords clear cells");
assert.deepEqual(resolvePlaceGeoCellPatch({ lat: 0, lng: 0 }), { geoCell6: null, geoCell5: null }, "(0,0) is not a location");
assert.equal(resolvePlaceGeoCellPatch({ lat: 53.9, lng: 27.5, geoCell6: "abcdef" }), null, "explicit cells win (backfill)");
assert.deepEqual(resolvePlaceGeoCellPatch({ lat: 53.9006 }, { lat: null, lng: 27.559 }), expected, "partial write reads the other side");
assert.deepEqual(inspectPlaceCoordinateWrite({ lat: 1 }), { touchesCoordinates: true, needsCurrentRow: true });
assert.deepEqual(inspectPlaceCoordinateWrite({ lat: 1, lng: 2 }), { touchesCoordinates: true, needsCurrentRow: false });
assert.deepEqual(inspectPlaceCoordinateWrite(undefined), { touchesCoordinates: false, needsCurrentRow: false });

async function main() {
  process.env.DAY_SCENARIO_ENGINE_ENABLED = "true";
  // --- extension wiring with a fake client ---
  type Rec = Record<string, unknown>;
  type Hook = (a: { args: Rec; query: (a: unknown) => Promise<unknown> }) => Promise<unknown>;
  let hooks: Record<string, Hook> = {};
  const fakeClient = { $extends: (def: { query: { place: Record<string, Hook> } }) => { hooks = def.query.place; return { extended: true }; } } as unknown as PrismaClient;
  let readerCalls = 0;
  const reader = { place: { findUnique: async () => { readerCalls += 1; return { lat: null, lng: 27.559 }; } } } as unknown as PrismaClient;
  extendPrismaWithPlaceGeoCells(fakeClient, reader);

  const seen: unknown[] = [];
  const query = async (a: unknown) => { seen.push(a); return a; };

  await hooks.create({ args: { data: { title: "t", lat: 53.9006, lng: 27.559 } }, query });
  assert.deepEqual((seen.pop() as { data: Rec }).data, { title: "t", lat: 53.9006, lng: 27.559, ...expected });

  await hooks.create({ args: { data: { title: "no coords" } }, query });
  assert.deepEqual((seen.pop() as { data: Rec }).data, { title: "no coords" });

  await hooks.update({ args: { where: { id: "p1" }, data: { lat: 53.9006 } }, query });
  assert.equal(readerCalls, 1, "partial update reads the row once");
  assert.equal((seen.pop() as { data: Rec }).data.geoCell6, expected.geoCell6);

  await hooks.update({ args: { where: { id: "p1" }, data: { status: "PUBLISHED" } }, query });
  assert.equal(readerCalls, 1, "non-coordinate update adds no reads");
  seen.pop();

  await hooks.upsert({ args: { where: { id: "p1" }, create: { lat: 53.9006, lng: 27.559 }, update: { lat: 53.9006, lng: 27.559 } }, query });
  const up = seen.pop() as { create: Rec; update: Rec };
  assert.equal(up.create.geoCell5, expected.geoCell5);
  assert.equal(up.update.geoCell5, expected.geoCell5);

  await hooks.createMany({ args: { data: [{ lat: 53.9006, lng: 27.559 }, { title: "n" }] }, query });
  const many = (seen.pop() as { data: Rec[] }).data;
  assert.equal(many[0].geoCell6, expected.geoCell6);
  assert.equal("geoCell6" in many[1], false);

  await hooks.updateMany({ args: { where: {}, data: { lat: 1 } }, query });
  assert.equal("geoCell6" in (seen.pop() as { data: Rec }).data, false, "one-sided updateMany is left to backfill --check");

  process.env.DAY_SCENARIO_ENGINE_ENABLED = "false";
  await hooks.create({ args: { data: { title: "t", lat: 53.9006, lng: 27.559 } }, query });
  assert.deepEqual((seen.pop() as { data: Rec }).data, { title: "t", lat: 53.9006, lng: 27.559 }, "flag off: Place writes pass through unchanged");
  await hooks.update({ args: { where: { id: "p1" }, data: { lat: 53.9006 } }, query });
  assert.equal(readerCalls, 1, "flag off: no extra read on partial updates");
  seen.pop();

  console.log("placeGeoCells tests passed");
}

main().catch((error) => { console.error(error); process.exit(1); });
