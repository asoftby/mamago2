import assert from "node:assert/strict";
import { createPartyConfirmCallback, verifyPartyConfirmCallback } from "./partyTelegramActionToken";

const secret = "local-test-secret-do-not-use-in-production";
const chatId = "123456789";
const now = 1_797_000_000_000;
const token = createPartyConfirmCallback({
  requestId: "cmh12345678901234567890", quoteVersion: 7, chatId, secret, now,
});
assert.ok(Buffer.byteLength(token, "utf8") <= 64);
assert.deepEqual(verifyPartyConfirmCallback({ token, chatId, secret, now }), {
  kind: "CONFIRM", requestId: "cmh12345678901234567890", quoteVersion: 7,
  issuedMinute: Math.floor(now / 60_000),
});
assert.equal(verifyPartyConfirmCallback({ token, chatId: "987654321", secret, now }), null);
assert.equal(verifyPartyConfirmCallback({ token, chatId, secret: "other", now }), null);
assert.equal(verifyPartyConfirmCallback({ token: token.replace(":7:", ":8:"), chatId, secret, now }), null);
assert.equal(verifyPartyConfirmCallback({ token, chatId, secret, now: now - 120_000 }), null);
assert.equal(verifyPartyConfirmCallback({ token, chatId, secret, now: now + 24 * 60 * 60_000 + 60_000 }), null);
assert.equal(verifyPartyConfirmCallback({ token: token + "padding", chatId, secret, now }), null);
assert.throws(() => createPartyConfirmCallback({ requestId: "../secret", quoteVersion: 1, chatId, secret, now }));
assert.throws(() => createPartyConfirmCallback({ requestId: "x".repeat(37), quoteVersion: 1, chatId, secret, now }));
console.log("Party Telegram signed callback tests: OK");
