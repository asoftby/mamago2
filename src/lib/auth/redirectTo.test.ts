import assert from "node:assert/strict";

import {
  buildAuthUrl,
  buildCurrentPath,
  getSafeRedirectPath,
  readRedirectParam,
  readRedirectParamWithFallback,
} from "./redirectTo";

assert.equal(getSafeRedirectPath("/minsk/events", "/"), "/minsk/events");
assert.equal(getSafeRedirectPath("/minsk/events?age=3-6", "/"), "/minsk/events?age=3-6");
assert.equal(getSafeRedirectPath("https://evil.com", "/fallback"), "/fallback");
assert.equal(getSafeRedirectPath("//evil.com", "/fallback"), "/fallback");
assert.equal(getSafeRedirectPath("", "/fallback"), "/fallback");

const bothParams = new URLSearchParams("next=/old&redirectTo=/new");
assert.equal(readRedirectParam(bothParams), "/new");

const legacyParams = new URLSearchParams("next=/legacy");
assert.equal(readRedirectParam(legacyParams), "/legacy");

const unsafeParams = new URLSearchParams("redirectTo=https://evil.com");
assert.equal(readRedirectParamWithFallback(unsafeParams, "/me"), "/me");

assert.equal(
  buildAuthUrl({ redirectTo: "/minsk/events?when=weekend" }),
  "/login?redirectTo=%2Fminsk%2Fevents%3Fwhen%3Dweekend",
);
assert.equal(
  buildAuthUrl({ mode: "register", redirectTo: "/minsk" }),
  "/register?mode=register&redirectTo=%2Fminsk",
);

assert.equal(buildCurrentPath("/minsk", "?age=3"), "/minsk?age=3");
assert.equal(buildCurrentPath("/minsk", "age=3"), "/minsk?age=3");

console.log("redirectTo.test.ts: ok");
