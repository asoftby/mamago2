/**
 * Run: npx tsx src/lib/analytics/clientClass.test.ts
 */
import assert from "node:assert/strict";
import { classifyUserAgent, decideClientIngestion } from "./clientClass";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const BOTS = [
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
  "TelegramBot (like TwitterBot)",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "WhatsApp/2.23.20.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0 Safari/537.36",
  "curl/8.5.0",
];

assert.equal(classifyUserAgent(CHROME), "browser");
assert.equal(classifyUserAgent(SAFARI_IOS), "browser");
for (const ua of BOTS) assert.equal(classifyUserAgent(ua), "bot", ua);
assert.equal(classifyUserAgent(""), "unknown");
assert.equal(classifyUserAgent("   "), "unknown");
assert.equal(classifyUserAgent(null), "unknown");
assert.equal(classifyUserAgent(undefined), "unknown");

// Bot is rejected even when it carries identity (bot share must not be under-counted).
assert.deepEqual(decideClientIngestion({ userAgent: BOTS[0], userId: "u1", sessionId: "s1" }), {
  accept: false,
  reason: "bot",
});
// Anonymous without sessionId: rejected.
assert.deepEqual(decideClientIngestion({ userAgent: CHROME, userId: null, sessionId: null }), {
  accept: false,
  reason: "no_identity",
});
assert.deepEqual(decideClientIngestion({ userAgent: CHROME, userId: null, sessionId: "  " }), {
  accept: false,
  reason: "no_identity",
});
// Anonymous with sessionId / authenticated without sessionId: accepted.
assert.deepEqual(decideClientIngestion({ userAgent: CHROME, userId: null, sessionId: "s1" }), {
  accept: true,
  clientClass: "browser",
});
assert.deepEqual(decideClientIngestion({ userAgent: "", userId: "u1", sessionId: null }), {
  accept: true,
  clientClass: "unknown",
});

console.log("clientClass.test.ts: OK");
