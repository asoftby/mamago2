import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyTelegramWebAppInitData } from "./verifyWebAppInitData";

const botToken = "111111:sample-bot-secret";
const now = 1792100000;

function signData(fields: Record<string, string>, includeSignature = true) {
  const data = new URLSearchParams(fields);
  const checkString = [...data.entries()]
    .filter(([key]) => key !== "hash" && (includeSignature || key !== "signature"))
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(checkString).digest("hex");
  data.set("hash", hash);
  return data.toString();
}

test("accepts fresh Telegram-signed data and returns the Telegram identity", () => {
  const signed = signData({
    auth_date: String(now - 10),
    query_id: "AAEHx",
    user: JSON.stringify({ id: 123456789, first_name: "Test" }),
  });
  assert.deepEqual(verifyTelegramWebAppInitData(signed, botToken, now), {
    telegramUserId: "123456789",
  });
});

test("rejects tampering, wrong bot, missing hash, replay and future data", () => {
  const fields = { auth_date: String(now), user: JSON.stringify({ id: 777 }) };
  const valid = signData(fields);
  assert.equal(verifyTelegramWebAppInitData(valid.replace("777", "778"), botToken, now), null);
  assert.equal(verifyTelegramWebAppInitData(valid, "wrong-token", now), null);
  assert.equal(verifyTelegramWebAppInitData(new URLSearchParams(fields).toString(), botToken, now), null);
  assert.equal(verifyTelegramWebAppInitData(signData({ ...fields, auth_date: String(now - 301) }), botToken, now), null);
  assert.equal(verifyTelegramWebAppInitData(signData({ ...fields, auth_date: String(now + 61) }), botToken, now), null);
  assert.equal(verifyTelegramWebAppInitData(valid + "&user=%7B%22id%22%3A888%7D", botToken, now), null);
});

test("requires a valid positive Telegram user id and supports optional signature field", () => {
  const invalidId = signData({ auth_date: String(now), user: JSON.stringify({ id: "777" }) });
  assert.equal(verifyTelegramWebAppInitData(invalidId, botToken, now), null);

  const fields = {
    auth_date: String(now),
    signature: "ed25519-sample",
    user: JSON.stringify({ id: 345 }),
  };
  assert.deepEqual(verifyTelegramWebAppInitData(signData(fields, false), botToken, now), {
    telegramUserId: "345",
  });
});
