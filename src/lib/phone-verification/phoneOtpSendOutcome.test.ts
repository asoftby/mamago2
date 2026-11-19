import assert from "node:assert/strict";
import { resolvePhoneOtpSendOutcome as decide } from "./phoneOtpSendOutcome";

const phone = "+375291234567";

// Normal success enters OTP and shows a 60s cooldown.
assert.deepEqual(decide(true, { phoneE164: phone, resendAfterSec: 60 }, phone), {
  step: "confirm", phoneE164: phone, cooldownSec: 60, warning: null,
});

// Provider transport ambiguity must NOT discard the retained OTP.
const unknown = decide(false, {
  code: "SMS_DELIVERY_UNKNOWN",
  error: "Код ещё может прийти — введите его, если получите.",
  resendAfterSec: 60,
}, phone);
assert.equal(unknown.step, "confirm");
if (unknown.step === "confirm") {
  assert.equal(unknown.phoneE164, phone);
  assert.equal(unknown.cooldownSec, 60);
  assert.match(unknown.warning ?? "", /Код ещё может прийти/);
}

// Non-ambiguous failures must never open confirmation without a valid OTP.
for (const [code, expectedError] of [
  ["SMS_DELIVERY_FAILED", "Отправка отклонена"],
  ["SMS_RATE_LIMITED", "Лимит SMS исчерпан"],
  ["OTP_LOCKED", "Повторите позже"],
] as const) {
  assert.deepEqual(decide(false, { code, error: expectedError }, phone), {
    step: "entry", error: expectedError,
  });
}
assert.deepEqual(decide(false, null, phone), {
  step: "entry", error: "Не удалось отправить код",
});
const fallback = decide(false, { code: "SMS_DELIVERY_UNKNOWN" }, phone);
assert.equal(fallback.step, "confirm");
if (fallback.step === "confirm") {
  assert.equal(fallback.cooldownSec, 60);
  assert.match(fallback.warning ?? "", /не подтверждена/i);
}
console.log("phoneOtpSendOutcome.test.ts passed");
