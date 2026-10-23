import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const code = readFileSync("src/server/birthday/partyTelegramConfirmAction.service.ts", "utf8");
const token = readFileSync("src/server/birthday/partyTelegramActionToken.ts", "utf8");
assert.match(code, /verifyPartyConfirmCallback/);
assert.match(code, /input\.chatId !== input\.telegramUserId/);
assert.match(code, /resolveBusinessBotActor\(input\.telegramUserId, input\.chatId\)/);
assert.match(code, /isActive: true/);
assert.match(code, /business: \{ operationalStatus: "ACTIVE" \}/);
assert.match(code, /role: \{ in: \["OWNER", "MANAGER"\] \}/);
assert.match(code, /confirmPartyRequest\(/);
assert.match(code, /idempotencyKey: "tg_" \+ createHash\("sha256"\)/);
assert.match(code, /expectedQuoteVersion: command\.quoteVersion/);
assert.match(code, /STALE_REQUEST/);
assert.doesNotMatch(code, /getActiveTelegramConnectionForCurrentEnvironment/);
assert.match(token, /timingSafeEqual/);
console.log("Party Telegram confirmation action safety contracts: OK");
