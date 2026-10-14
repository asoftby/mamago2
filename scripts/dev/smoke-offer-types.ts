// Смоук мастера предложений через HTTP: создание оффера каждого типа реальным маппером мастера,
// открытие редактора, публикация и публичная карточка, правка опубликованного (цена — сразу, текст — ревизия).
//   SMOKE_BASE_URL=http://localhost:3010 NODE_OPTIONS=--conditions=react-server npx tsx scripts/dev/smoke-offer-types.ts
// Нужны запущенный `pnpm dev` и ЛОКАЛЬНАЯ БД (скрипт создаёт и удаляет свои данные).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { getDefaultFormData } from "../../src/components/business/wizard/offer/defaults";
import { getOfferTypeSelection } from "../../src/components/business/wizard/offer/offerTypeChoices";
import { buildOfferCreatePayload, buildOfferUpdatePayload } from "../../src/components/business/wizard/offer/mappers";
import { offerOperationalVersion } from "../../src/lib/offers/offerOperationalVersion";
import type { OfferFormData, OfferProductType } from "../../src/components/business/wizard/offer/types";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !["127.0.0.1", "localhost"].includes(new URL(dbUrl).hostname)) {
  throw new Error("smoke-offer-types works only against a localhost PostgreSQL DATABASE_URL");
}
const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const db = new PrismaClient();
const run = randomUUID().slice(0, 8);
const password = `Sm-${randomUUID().slice(0, 10)}`;
const TYPES: OfferProductType[] = ["PLACE_VISIT", "ONE_TIME_ACTIVITY", "REGULAR_ACTIVITY", "CAMP", "PARTY_SERVICE", "PARTY_PACKAGE"];
const created = { users: [] as string[], offers: [] as string[], place: "", business: "" };
const results: string[] = [];

async function login(email: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  assert.ok(res.status < 400, `login -> ${res.status}`);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

function formFor(productType: OfferProductType, placeId: string, price: string, description: string): OfferFormData {
  const form: OfferFormData = {
    ...getDefaultFormData(placeId),
    ...getOfferTypeSelection(productType),
    title: `Смоук ${productType} ${run}`,
    shortDescription: description.replace(/<[^>]+>/g, "").slice(0, 100),
    description,
    pricingMode: "single",
    singlePrice: price,
    phone: "+375291112233",
  };
  if (productType === "CAMP") {
    form.campProgramType = "городской";
    form.campSessions = [
      { id: `cs-${run}`, title: "Июнь", dateFrom: "2026-06-03", dateTo: "2026-06-10", priceOverride: price, capacity: 20 } as never,
    ];
  }
  return form;
}

async function main() {
  const hash = await bcrypt.hash(password, 10);
  const ownerEmail = `smoke-types-owner-${run}@example.test`;
  const owner = await db.user.create({ data: { email: ownerEmail, passwordHash: hash, role: "BUSINESS_OWNER", emailVerifiedAt: new Date() } });
  created.users.push(owner.id);
  const city = await db.city.findFirstOrThrow({ where: { slug: "minsk" } });
  const business = await db.business.create({ data: { name: `SmokeTypes ${run}`, ownerUserId: owner.id, verificationStatus: "APPROVED" } });
  created.business = business.id;
  await db.businessMember.create({ data: { businessId: business.id, userId: owner.id, role: "OWNER", isActive: true } }).catch(() => null);
  const place = await db.place.create({
    data: { title: `Smoke place ${run}`, shortDesc: "Smoke", createdByUserId: owner.id, ownerBusinessId: business.id, cityId: city.id, status: "PUBLISHED", activityTypes: [], ageTags: [], visitFormats: [] },
  });
  created.place = place.id;
  const cookie = await login(ownerEmail);

  for (const [index, productType] of TYPES.entries()) {
    const form = formFor(productType, place.id, "50", "<p>Описание оффера для смоука, достаточно длинное для проверки</p>");
    const payload = buildOfferCreatePayload(form, { status: "DRAFT", createRequestId: `smoke-${run}-${index}` });
    const createRes = await fetch(`${BASE}/api/business/offers`, {
      method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(payload),
    });
    const createJson = (await createRes.json().catch(() => null)) as { id?: string } | null;
    assert.equal(createRes.status, 200, `${productType} create -> ${createRes.status} ${JSON.stringify(createJson)}`);
    const id = createJson!.id!;
    created.offers.push(id);

    const editor = await fetch(`${BASE}/editor/offer/${id}/edit`, { headers: { cookie }, redirect: "manual" });
    assert.equal(editor.status, 200, `${productType} editor -> ${editor.status}`);

    // публикуем напрямую (как модератор) и проверяем публичную карточку
    const slug = `smoke-${productType.toLowerCase().replace(/_/g, "-")}-${run}`;
    await db.offer.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date(), slug, cityId: city.id } });
    const publicPage = await fetch(`${BASE}/minsk/offers/${slug}`);
    const html = await publicPage.text();
    assert.equal(publicPage.status, 200, `${productType} public -> ${publicPage.status}`);
    assert.ok(html.includes(`Смоук ${productType}`), `${productType} public card shows the title`);

    // правка опубликованного: цена сразу, описание — в ревизию
    const live = await db.offer.findUniqueOrThrow({ where: { id }, include: { place: { select: { id: true, title: true } }, placements: true, categoryLinks: true } });
    const next = formFor(productType, place.id, "77", "<p>Новое описание от партнёра, тоже достаточно длинное для смоука</p>");
    const updatePayload = buildOfferUpdatePayload(next, {});
    const upd = await fetch(`${BASE}/api/business/offers/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ ...updatePayload, expectedOperationalVersion: offerOperationalVersion(live as unknown as Record<string, unknown>) }),
    });
    const updJson = (await upd.json().catch(() => null)) as Record<string, any> | null;
    assert.equal(upd.status, 200, `${productType} published edit -> ${upd.status} ${JSON.stringify(updJson)}`);
    const after = await db.offer.findUniqueOrThrow({ where: { id } });
    const revision = await db.offerRevision.findFirst({ where: { offerId: id, status: "PENDING" } });
    assert.equal(after.status, "PUBLISHED", `${productType} stays published`);
    assert.ok(after.description?.includes("Описание оффера для смоука"), `${productType} live description unchanged`);
    assert.ok(revision && revision.changedFields.includes("description"), `${productType} description went to a revision`);
    // CAMP uses the session-level override, other offer types use priceFrom.
    if (productType === "CAMP") {
      const sessions = after.campSessions;
      assert.ok(Array.isArray(sessions) && sessions.length > 0, "CAMP sessions persisted");
      const firstSession = sessions[0] as { priceOverride?: string | number | null };
      assert.equal(Number(firstSession.priceOverride), 77, "CAMP session price applied immediately");
    } else {
      assert.equal(Number(after.priceFrom), 77, `${productType} price applied immediately`);
    }
    results.push(`${productType}: create OK, editor 200, public 200, price applied, revision [${revision!.changedFields.join(", ")}]`);
  }

  console.log(results.join("\n"));
  console.log("SMOKE TYPES OK");
}

main()
  .catch((e) => { console.error("SMOKE TYPES FAILED:", e); process.exitCode = 1; })
  .finally(async () => {
    if (created.offers.length) {
      await db.offer.deleteMany({ where: { id: { in: created.offers } } });
      await db.adminAuditLog.deleteMany({ where: { entityId: { in: created.offers } } });
    }
    await db.notification.deleteMany({ where: { userId: { in: created.users } } });
    if (created.place) await db.place.deleteMany({ where: { id: created.place } });
    if (created.business) { await db.businessMember.deleteMany({ where: { businessId: created.business } }); await db.business.deleteMany({ where: { id: created.business } }); }
    await db.user.deleteMany({ where: { id: { in: created.users } } });
    await db.$disconnect();
  });
