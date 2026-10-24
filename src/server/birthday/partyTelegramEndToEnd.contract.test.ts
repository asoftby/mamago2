import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPartyConfirmCallback, verifyPartyConfirmCallback } from "./partyTelegramActionToken";
import { canConfirmPartyWithOneTap } from "./partyTelegramButtonPolicy";

const read = (path: string) => readFileSync(path, "utf8");
const producer = read("src/server/birthday/partyTelegramKeyboard.service.ts");
const delivery = read("src/server/services/notificationDelivery.service.ts");
const webhook = read("src/app/api/business/telegram/webhook/route.ts");
const consumer = read("src/server/birthday/partyTelegramConfirmAction.service.ts");

for (const fragment of [
  'eventType: "PARTY_QUOTE_ACCEPTED"', 'aggregateId: notification.entityId',
  'businessId: recipient.businessId', 'partyStage: "AWAITING_RECONFIRM"',
  'status: "NEW"', 'status: "ACCEPTED"',
  "listPartyConfirmChoices(", "canConfirmPartyWithOneTap(",
  "createPartyConfirmCallback(", "chatId: recipient.chatId",
]) assert.ok(producer.includes(fragment), "Producer missing " + fragment);
assert.match(delivery, /buildPartyConfirmationTelegramKeyboard\(\s*notification, businessRecipient/);
assert.match(delivery, /partyMarkup \?\? rendered\.replyMarkup/);
assert.match(webhook, /x-telegram-bot-api-secret-token/);
assert.match(webhook, /timingSafeEqual\(expected, actual\)/);
assert.match(webhook, /businessTelegramDeliveryEnabled\(\)/);
assert.match(webhook, /chat\?\.type === "private"/);
assert.match(webhook, /handlePartyTelegramConfirmation\(/);
assert.match(webhook, /environment: config\.environment/);
assert.match(webhook, /answerCallbackQuery/);
assert.match(consumer, /verifyPartyConfirmCallback/);
assert.match(consumer, /confirmPartyRequest\(/);
assert.match(consumer, /role: \{ in: \["OWNER", "MANAGER"\] \}/);
assert.doesNotMatch(webhook, /getActiveTelegramConnectionForCurrentEnvironment/);

// Signed data is bound to recipient chat; the sender and receiver use the
// same token contract, and a stale or forged recipient cannot use it.
const now = 1_797_000_000_000;
const secret = "contract-test-secret";
const callback = createPartyConfirmCallback({
  requestId: "cmh12345678901234567890", quoteVersion: 4,
  chatId: "12345", secret, now,
});
assert.ok(Buffer.byteLength(callback, "utf8") <= 64);
assert.equal(verifyPartyConfirmCallback({ token: callback, chatId: "12345", secret, now })?.quoteVersion, 4);
assert.equal(verifyPartyConfirmCallback({ token: callback, chatId: "99999", secret, now }), null);
assert.equal(canConfirmPartyWithOneTap({ availableUnitIds: ["a"],
  activeMappedUnitCount: 2, acceptedQuoteUnitId: null, manualAllowed: false }), false);

console.log("Party Telegram producer → delivery → webhook wiring contracts: OK");
