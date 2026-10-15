import assert from "node:assert/strict";
import test from "node:test";
import { createTelegramLinkButton, getSafeTelegramReturnPath } from "./webAppButton";

test("internal HTTPS bot links launch signed Telegram Web App with original destination", () => {
  assert.deepEqual(createTelegramLinkButton(
    "Открыть план", "https://dev.mamago.by/me/plan?date=2026-10-15", "https://dev.mamago.by",
  ), {
    text: "Открыть план",
    web_app: { url: "https://dev.mamago.by/telegram/open?next=%2Fme%2Fplan%3Fdate%3D2026-10-15" },
  });
});

test("external destinations and insecure hosts remain ordinary links", () => {
  assert.deepEqual(createTelegramLinkButton("Read", "https://other.example/a", "https://mamago.by"), {
    text: "Read", url: "https://other.example/a",
  });
  assert.deepEqual(createTelegramLinkButton("Plan", "/me/plan", "http://localhost:3000"), {
    text: "Plan", url: "/me/plan",
  });
});

test("malicious and auth-loop next targets never redirect outside mamaGo", () => {
  for (const next of [
    "//attacker.example", "/\\attacker.example", "/%5cattacker.example",
    "https://attacker.example", "/api/auth/logout", "/telegram/open",
    "/login", "/%2f%2fattacker.example",
  ]) {
    assert.equal(getSafeTelegramReturnPath(next), "/me/plan", next);
  }
  assert.equal(getSafeTelegramReturnPath("/me/plan?date=2026-10-15"), "/me/plan?date=2026-10-15");
});
