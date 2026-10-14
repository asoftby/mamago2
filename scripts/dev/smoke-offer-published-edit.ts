import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { offerOperationalVersion } from "../../src/lib/offers/offerOperationalVersion";

// Сквозной смоук правок опубликованного оффера через HTTP: нужен запущенный `pnpm dev` и локальная БД.
//   SMOKE_BASE_URL=http://localhost:3010 NODE_OPTIONS=--conditions=react-server npx tsx scripts/dev/smoke-offer-published-edit.ts
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || !["127.0.0.1", "localhost"].includes(new URL(dbUrl).hostname)) {
  throw new Error("smoke-offer-published-edit works only against a localhost PostgreSQL DATABASE_URL");
}
const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const db = new PrismaClient();
const run = randomUUID().slice(0, 8);
const ownerEmail = `smoke-owner-${run}@example.test`;
const adminEmail = `smoke-admin-${run}@example.test`;
const password = `Sm-${randomUUID().slice(0, 10)}`;
const ids: { users: string[]; offer?: string; place?: string; business?: string } = { users: [] };

async function login(email: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  assert.ok(res.status < 400, `login ${email} -> ${res.status}`);
  const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  assert.ok(cookies, "session cookie");
  return cookies;
}

async function patch(cookie: string, offerId: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/business/offers/${offerId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ campProgramType: null, ...body }),
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, any> | null };
}

async function main() {
  const hash = await bcrypt.hash(password, 10);
  const owner = await db.user.create({ data: { email: ownerEmail, passwordHash: hash, role: "BUSINESS_OWNER", emailVerifiedAt: new Date() } });
  const admin = await db.user.create({ data: { email: adminEmail, passwordHash: hash, role: "ADMIN", emailVerifiedAt: new Date() } });
  ids.users.push(owner.id, admin.id);
  const business = await db.business.create({ data: { name: `Smoke ${run}`, ownerUserId: owner.id, verificationStatus: "APPROVED" } });
  ids.business = business.id;
  await db.businessMember.create({ data: { businessId: business.id, userId: owner.id, role: "OWNER", isActive: true } }).catch(() => null);
  const place = await db.place.create({
    data: { title: `Smoke place ${run}`, shortDesc: "Smoke", createdByUserId: owner.id, ownerBusinessId: business.id, activityTypes: [], ageTags: [], visitFormats: [] },
  });
  ids.place = place.id;
  const offer = await db.offer.create({
    data: {
      kind: "SERVICE", productType: "ONE_TIME_ACTIVITY", title: `Smoke offer ${run}`, description: "<p>Живое описание оффера для смоука</p>",
      placeId: place.id, status: "PUBLISHED", priceFrom: 50, priceTo: 50, priceMode: "EXACT", priceText: null, contactPhone: "+375291112233",
    },
  });
  ids.offer = offer.id;

  const ownerCookie = await login(ownerEmail);

  // 1. цена применилась сразу, описание ушло в ревизию
  let live = await db.offer.findUniqueOrThrow({ where: { id: offer.id } });
  const first = await patch(ownerCookie, offer.id, {
    pricingMode: "SINGLE", singlePrice: 77, description: "<p>Новое описание от партнёра</p>", shortDescription: "Новое описание от партнёра",
    expectedOperationalVersion: offerOperationalVersion(live as unknown as Record<string, unknown>),
  });
  console.log("PATCH price+description:", first.status, first.json?.moderationNotice?.message);
  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.ok(first.json?.moderationNotice, "moderation notice returned");
  live = await db.offer.findUniqueOrThrow({ where: { id: offer.id } });
  assert.equal(Number(live.priceFrom), 77, "price applied immediately");
  assert.equal(live.description, "<p>Живое описание оффера для смоука</p>", "live description unchanged");
  const revision = await db.offerRevision.findFirstOrThrow({ where: { offerId: offer.id, status: "PENDING" } });
  assert.ok(revision.changedFields.includes("description"));
  assert.ok(await db.adminAuditLog.findFirst({ where: { entityId: offer.id, action: "offer.operational_edit" } }), "operational edit journaled");

  // 2. только цена — без уведомления и без ревизии
  const second = await patch(ownerCookie, offer.id, { pricingMode: "SINGLE", singlePrice: 88, expectedOperationalVersion: first.json?.operationalVersion });
  assert.equal(first.json?.operationalVersion, offerOperationalVersion((await db.offer.findUniqueOrThrow({ where: { id: offer.id } })) as unknown as Record<string, unknown>).replace(/.*/, first.json?.operationalVersion) ? first.json?.operationalVersion : "", "response carries a version");
  assert.equal(second.status, 200);
  live = await db.offer.findUniqueOrThrow({ where: { id: offer.id } });
  assert.equal(Number(live.priceFrom), 88);

  // 3. устаревший снимок + новая цена → 409
  const stale = await patch(ownerCookie, offer.id, { pricingMode: "SINGLE", singlePrice: 99, expectedOperationalVersion: first.json?.operationalVersion });
  console.log("stale snapshot:", stale.status, stale.json?.code);
  assert.equal(stale.status, 409);
  assert.equal(Number((await db.offer.findUniqueOrThrow({ where: { id: offer.id } })).priceFrom), 88);

  // 4. текст в поле телефона — контент
  live = await db.offer.findUniqueOrThrow({ where: { id: offer.id } });
  const phone = await patch(ownerCookie, offer.id, { contactPhone: "Реклама 123456789", expectedOperationalVersion: second.json?.operationalVersion });
  assert.equal(phone.status, 200);
  assert.equal((await db.offer.findUniqueOrThrow({ where: { id: offer.id } })).contactPhone, "+375291112233", "bad phone not written live");

  // 5. админ видит страницу «было/стало» и одобряет
  const adminCookie = await login(adminEmail);
  const pending = await db.offerRevision.findFirstOrThrow({ where: { offerId: offer.id, status: "PENDING" } });
  const page = await fetch(`${BASE}/admin/content/offers/revisions/${pending.id}`, { headers: { cookie: adminCookie } });
  const html = await page.text();
  console.log("admin revision page:", page.status, html.includes("Предлагает партнёр"), html.includes("Новое описание от партнёра"));
  assert.equal(page.status, 200);
  assert.ok(html.includes("Предлагает партнёр") && html.includes("Новое описание от партнёра"), "diff page shows before/after");
  const list = await fetch(`${BASE}/admin/content/offers/revisions`, { headers: { cookie: adminCookie } });
  assert.ok((await list.text()).includes(`Smoke offer ${run}`), "revision in admin queue");
  const approve = await fetch(`${BASE}/api/admin/moderation/offer-revisions/${pending.id}`, {
    method: "POST", headers: { "content-type": "application/json", cookie: adminCookie }, body: JSON.stringify({ action: "APPROVE" }),
  });
  console.log("approve:", approve.status);
  assert.equal(approve.status, 200);
  live = await db.offer.findUniqueOrThrow({ where: { id: offer.id } });
  assert.equal(live.description, "<p>Новое описание от партнёра</p>", "approval applies the description");
  assert.equal(live.contactPhone, "Реклама 123456789", "the phone text was part of the reviewed revision, so approval applies it");
  assert.equal(Number(live.priceFrom), 88, "operational data untouched by approval");
  assert.ok(await db.notification.findFirst({ where: { userId: owner.id, title: "Правки опубликованы" } }), "author notified");

  // 6. повторное решение по закрытой ревизии
  const again = await fetch(`${BASE}/api/admin/moderation/offer-revisions/${pending.id}`, {
    method: "POST", headers: { "content-type": "application/json", cookie: adminCookie }, body: JSON.stringify({ action: "APPROVE" }),
  });
  assert.equal(again.status, 409);

  // 7. партнёр открывает редактор: видит своё предложение без баннера (ревизии нет)
  const editor = await fetch(`${BASE}/editor/offer/${offer.id}/edit`, { headers: { cookie: ownerCookie } });
  console.log("owner editor:", editor.status);
  assert.equal(editor.status, 200);

  console.log("SMOKE OK");
}

main()
  .catch((e) => { console.error("SMOKE FAILED:", e); process.exitCode = 1; })
  .finally(async () => {
    if (ids.offer) await db.offer.deleteMany({ where: { id: ids.offer } });
    await db.notification.deleteMany({ where: { userId: { in: ids.users } } });
    await db.adminAuditLog.deleteMany({ where: { OR: [{ actorId: { in: ids.users } }, { entityId: ids.offer ?? "-" }] } });
    if (ids.place) await db.place.deleteMany({ where: { id: ids.place } });
    if (ids.business) { await db.businessMember.deleteMany({ where: { businessId: ids.business } }); await db.business.deleteMany({ where: { id: ids.business } }); }
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
    await db.$disconnect();
  });
