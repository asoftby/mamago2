import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { savePackageComponents } from "./packageComponents";

const url = process.env.DATABASE_URL;
if (!url || new URL(url).hostname !== "127.0.0.1" || !["/mamago_a2_test", "/mamago_a3_test"].includes(new URL(url).pathname))
  throw new Error("Requires a disposable mamaGo test database on 127.0.0.1");
const db = new PrismaClient({ datasourceUrl: url });
test("canonical composition transactions preserve pricing, reject stale/foreign input, and support draft type change", async () => {
  const user = await db.user.create({ data: { email: `a2-${Date.now()}@example.test` } });
  let businessId = "", placeId = "";
  try {
    const business = await db.business.create({ data: { name: "A2 synthetic", ownerUserId: user.id } }); businessId = business.id;
    const place = await db.place.create({ data: { title: "A2 synthetic", shortDesc: "test", createdByUserId: user.id,
      ownerBusinessId: business.id, status: "PUBLISHED", activityTypes: [], ageTags: [], visitFormats: [] } }); placeId = place.id;
    const offer = await db.offer.create({ data: { placeId, title: "Package", kind: "SERVICE", productType: "PARTY_PACKAGE", status: "DRAFT" } });
    const component = await db.packageComponent.create({ data: { packageId: offer.id, title: "Зал", category: "VENUE", position: 0, isOptional: true, priceDelta: 17.5, priceSnapshot: 100 } });
    const baseline = [{ id: component.id, title: "Зал", category: "VENUE" as const }];
    await db.$transaction(tx => savePackageComponents(tx, offer.id, [{ ...baseline[0], title: "Зал на два часа" }], baseline));
    const saved = await db.packageComponent.findUniqueOrThrow({ where: { id: component.id } });
    assert.equal(saved.isOptional, true); assert.equal(saved.priceDelta?.toString(), "17.5"); assert.equal(saved.priceSnapshot?.toString(), "100");
    await assert.rejects(db.$transaction(tx => savePackageComponents(tx, offer.id, [], baseline)), /Состав изменился/);
    const current = [{ id: component.id, title: saved.title, category: saved.category }];
    await assert.rejects(db.$transaction(tx => savePackageComponents(tx, offer.id, [{ id: "foreign", title: "Чужой", category: "CAKE" }], current)), /не принадлежит/);
    assert.equal(await db.packageComponent.count({ where: { packageId: offer.id } }), 1);
    await db.offer.update({ where: { id: offer.id }, data: { status: "PUBLISHED" } });
    await assert.rejects(db.$transaction(tx => savePackageComponents(tx, offer.id, [], current)), /согласования/);
    await db.$transaction(tx => savePackageComponents(tx, offer.id, current, current));
    const order = await db.partyOrder.create({ data: { ownerUserId: user.id, citySlug: "synthetic", venueMode: "PACKAGE" } });
    try {
      const snapshot = { id: component.id, title: saved.title, category: saved.category, priceSnapshot: "100.00" };
      const item = await db.partyOrderItem.create({ data: { partyOrderId: order.id, category: saved.category, role: "INCLUDED",
        packageComponentId: component.id, packageComponentSnapshot: snapshot } });
      const legacy = await db.partyOrderItem.create({ data: { partyOrderId: order.id, category: saved.category, role: "INCLUDED",
        packageComponentId: component.id, offerPriceSnapshot: 80 } });
      const migration = readFileSync(new URL("../../../prisma/migrations/20261106030000_package_component_history/migration.sql", import.meta.url), "utf8");
      const backfill = migration.slice(migration.indexOf('UPDATE "PartyOrderItem"'));
      assert.equal(await db.$executeRawUnsafe(backfill), 1);
      assert.equal(await db.$executeRawUnsafe(backfill), 0);
      const migrated = await db.partyOrderItem.findUniqueOrThrow({ where: { id: legacy.id } });
      assert.deepEqual(migrated.packageComponentSnapshot, { id: component.id, category: saved.category, provenance: "LEGACY_LINK_ONLY" });
      assert.equal(migrated.offerPriceSnapshot?.toFixed(2), "80.00");
      await db.offer.update({ where: { id: offer.id }, data: { status: "DRAFT" } });
      await db.$transaction(tx => savePackageComponents(tx, offer.id, [], current));
      assert.ok((await db.packageComponent.findUniqueOrThrow({ where: { id: component.id } })).archivedAt);
      assert.equal(await db.packageComponent.count({ where: { packageId: offer.id, archivedAt: null } }), 0);
      await db.offer.delete({ where: { id: offer.id } });
      const historical = await db.partyOrderItem.findUniqueOrThrow({ where: { id: item.id } });
      assert.equal(historical.packageComponentId, null);
      assert.deepEqual(historical.packageComponentSnapshot, snapshot);
    } finally {
      await db.partyOrder.delete({ where: { id: order.id } });
    }
    const service = await db.offer.create({ data: { placeId, title: "Was service", kind: "SERVICE", productType: "PARTY_SERVICE", status: "DRAFT" } });
    await db.$transaction(async tx => {
      await savePackageComponents(tx, service.id, [{ title: "Торт", category: "CAKE" }], [], false, "PARTY_PACKAGE");
      await tx.offer.update({ where: { id: service.id }, data: { productType: "PARTY_PACKAGE" } });
    });
    assert.equal(await db.packageComponent.count({ where: { packageId: service.id } }), 1);
  } finally {
    if (placeId) { await db.offer.deleteMany({ where: { placeId } }); await db.place.delete({ where: { id: placeId } }); }
    if (businessId) await db.business.delete({ where: { id: businessId } });
    await db.user.delete({ where: { id: user.id } }); await db.$disconnect();
  }
});
