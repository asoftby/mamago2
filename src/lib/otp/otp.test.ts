import { test } from "node:test";
import assert from "node:assert/strict";
import { genCode4 } from "./otp";

test("OTP generation preserves four decimal digits", () => {
  for (let i = 0; i < 1000; i++) {
    assert.match(genCode4(), /^\d{4}$/);
  }
});
