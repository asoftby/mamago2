import assert from "node:assert/strict";
import test from "node:test";
import { openPlanReplyMarkup, welcomeTextFor } from "./botWelcome";

test("full text is for the allowlist, short text has no forwarding paragraph", () => {
  assert.match(welcomeTextFor(true), /перешлите сообщение/i);
  assert.match(welcomeTextFor(true), /напишите своими словами/i);
  assert.match(welcomeTextFor(true), /только после вашего подтверждения/i);
  assert.doesNotMatch(welcomeTextFor(false), /перешлите|Попробуйте прямо сейчас/i);
  assert.match(welcomeTextFor(false), /напоминания/);
});

test("button points to /me/plan on a public https origin only", () => {
  assert.deepEqual(openPlanReplyMarkup("https://mamago.by"), {
    inline_keyboard: [[{ text: "Открыть Мой план", url: "https://mamago.by/me/plan" }]],
  });
  assert.equal(openPlanReplyMarkup("http://mamago.local:3000"), undefined);
  assert.equal(openPlanReplyMarkup("http://localhost:3000"), undefined);
  assert.equal(openPlanReplyMarkup("not a url"), undefined);
});
