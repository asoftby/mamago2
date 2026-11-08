import assert from "node:assert/strict";
import prisma from "@/lib/prisma";
import { createPartyDraft, updatePartyDraft } from "./partyDraft.service";
import { submitPartyAnchor } from "./partySubmit.service";
import { dispatchPartyOutbox } from "./partyOutbox.service";
import { retryFailedDelivery } from "@/server/services/notificationDelivery.service";
import { partyNotificationId } from "./partyOutbox.logic";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (url.hostname !== "127.0.0.1" || url.port !== "55443" || url.pathname !== "/mamago_birthday_it") throw Error("Not isolated IT database");
async function main() {
  Object.assign(process.env, { APP_ENV: "local", APP_PUBLIC_URL: "https://mamago.test", BUSINESS_BOOKINGS_INBOX_UI: "true",
    TELEGRAM_BUSINESS_DELIVERY_ENABLED: "true", TELEGRAM_BUSINESS_BOT_TOKEN_DEV: "LOCAL_FAKE_TOKEN",
    TELEGRAM_BUSINESS_BOT_USERNAME_DEV: "local_fake_business_bot", TELEGRAM_BUSINESS_WEBHOOK_SECRET_DEV: "local-fake-secret" });
  const parent = await prisma.user.findUniqueOrThrow({ where: { email: "parent@it.test" } });
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner-a@it.test" } });
  const business = await prisma.business.findFirstOrThrow({ where: { ownerUserId: owner.id } });
  await prisma.businessTelegramConnection.upsert({ where: { userId_environment: { userId: owner.id, environment: "DEV" } },
    update: { isActive: true, botUsername: "local_fake_business_bot" },
    create: { userId: owner.id, businessId: business.id, environment: "DEV", botUsername: "local_fake_business_bot",
      telegramUserId: "90000111", telegramChatId: "90000111" } });
  const created = await createPartyDraft(parent.id, { citySlug: "minsk", venueMode: "PACKAGE" });
  const selected = await updatePartyDraft(parent.id, created.id, { version: created.version, anchorOfferId: "it-offer-pkg", addonOfferIds: [] });
  const component = selected.items.find(item => item.role === "INCLUDED" && item.category === "ANIMATOR")!;
  const changed = await updatePartyDraft(parent.id, created.id, { version: selected.version, packageChange: { itemId: component.id } });
  const ready = await updatePartyDraft(parent.id, created.id, { version: changed.version,
    eventDate: new Date(Date.now() + 22 * 86400000).toISOString().slice(0, 10), timeFrom: "12:00", timeTo: "14:00",
    childrenCount: 8, adultsCount: 4, contactName: "Local parent", contactPhone: "+375291112233" });
  const sent = await submitPartyAnchor(parent.id, created.id, ready.version, "notification-" + created.id);
  const event = await prisma.partyOutbox.findUniqueOrThrow({ where: { dedupeKey: "party:" + sent.request.id + ":sent" } });
  // Dispatch this fixture first without touching any other queued event.
  await prisma.partyOutbox.update({ where: { id: event.id }, data: { createdAt: new Date(0) } });
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  const payloads: Array<{ reply_markup?: { inline_keyboard: Array<Array<{ url?: string }>> } }> = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.telegram.org/botLOCAL_FAKE_TOKEN/sendMessage", "All external network calls are intercepted");
    attempts++; payloads.push(JSON.parse(String(init?.body)));
    if (attempts === 1) throw Error("ECONNREFUSED isolated transport");
    return Response.json({ ok: true, result: { message_id: 1 } });
  };
  try {
    assert.equal((await dispatchPartyOutbox(1)).processed, 1);
    const notificationId = partyNotificationId(event.id, owner.id);
    const notice = await prisma.notification.findUniqueOrThrow({ where: { id: notificationId } });
    assert.match(notice.title, /изменение пакета/);
    assert.equal(notice.actionUrl, "/business/bookings?tab=action&kind=party&request=" + sent.request.id);
    const telegram = await prisma.notificationDelivery.findUniqueOrThrow({ where: { notificationId_channel: { notificationId, channel: "TELEGRAM" } } });
    assert.equal(telegram.status, "FAILED");
    assert.equal((await prisma.partyOrder.findUniqueOrThrow({ where: { id: created.id } })).status, "ANCHOR_PENDING");
    assert.equal(await retryFailedDelivery(telegram.id), true);
    assert.equal((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: telegram.id } })).status, "SENT");
    const link = payloads[1].reply_markup?.inline_keyboard.flat().find(button => button.url)?.url;
    assert.ok(link);
    const destination = new URL(link);
    assert.equal(destination.origin + destination.pathname, "https://mamago.test/business/bookings");
    assert.equal(destination.searchParams.get("request"), sent.request.id);
    assert.equal(destination.searchParams.get("kind"), "party");
    assert.equal(attempts, 2);
    // An ambiguous attempted event may be reconciled, never blindly sent again.
    await prisma.partyOutbox.update({ where: { id: event.id }, data: { status: "FAILED", nextAttemptAt: new Date(0) } });
    await dispatchPartyOutbox(1);
    assert.equal(attempts, 2);
    assert.equal(await prisma.notification.count({ where: { id: notificationId } }), 1);
    console.log("PASS mocked Telegram direct link, durable delivery failure/recovery and no duplicate notification/send");
  } finally { globalThis.fetch = originalFetch; }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
