import assert from "node:assert/strict";

import {
  buildAuthorReservedMessage,
  buildGuestReleaseMessage,
  buildThanksMessage,
  parseTelegramLinkPayload,
  telegramLinkPayload,
} from "./wishlistNotifyPure";

const secret = "test-secret";
const id = "cm0abcdefghijklmnopqrstuv";

const payload = telegramLinkPayload(id, secret);
assert.ok(payload && payload.length <= 64, "fits Telegram's 64-char start payload");
assert.equal(parseTelegramLinkPayload(payload!, secret), id);
assert.equal(parseTelegramLinkPayload(payload!, "other-secret"), null, "wrong secret");
assert.equal(parseTelegramLinkPayload(payload!.slice(0, -1) + (payload!.endsWith("A") ? "B" : "A"), secret), null, "tampered signature");
assert.equal(parseTelegramLinkPayload(`wl_${id}x_${"A".repeat(22)}`, secret), null, "another id with a forged signature");
assert.equal(parseTelegramLinkPayload("link_abc", secret), null);
assert.equal(parseTelegramLinkPayload(payload!, ""), null, "no secret → never valid");
assert.equal(telegramLinkPayload("bad id!", secret), null);
assert.equal(telegramLinkPayload(id, ""), null);

const msg = buildGuestReleaseMessage({ itemTitle: "LEGO", listTitle: "ДР Степана", reason: "replaced", listUrl: "https://x.test/w/t" });
assert.match(msg.text, /LEGO/);
assert.match(msg.text, /заменил/);
assert.match(msg.text, /https:\/\/x\.test\/w\/t/);

assert.equal(buildAuthorReservedMessage({ listTitle: "L", itemTitle: "I", displayName: null }).body.includes("«I»"), false, "anonymous text never names the gift");
assert.match(buildAuthorReservedMessage({ listTitle: "L", itemTitle: "I", displayName: "Аня" }).title, /Аня/);

console.log("wishlistNotifyPure ok");

{
  const t = buildThanksMessage({ itemTitle: "LEGO", listTitle: "ДР", message: "Было супер", listUrl: "https://x.test/w/t" });
  assert.match(t.subject, /LEGO/);
  assert.match(t.text, /Было супер/);
  assert.match(t.body, /Было супер/, "in-app notice keeps the author's whole text");
  assert.doesNotMatch(t.body, /x\.test/, "in-app notice has no link line (CTA carries it)");
  const multi = buildThanksMessage({ itemTitle: "A", listTitle: "B", message: "Раз\nДва\nТри", listUrl: "u" });
  assert.match(multi.body, /Три$/);
  assert.doesNotMatch(buildThanksMessage({ itemTitle: "A", listTitle: "B", message: null, listUrl: "u" }).text, /null/);
}
