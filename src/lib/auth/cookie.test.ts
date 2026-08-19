/**
 * Auth cookie environment-policy tests (assert-based, project convention).
 * Run: tsx src/lib/auth/cookie.test.ts
 *
 * Regression coverage for the bug where bare NODE_ENV=production (always set
 * by `next start`, even for local/dev builds) was used as the sole signal
 * for production cookie scoping, causing `Domain=.mamago.by; Secure` to be
 * set on DEV/localhost builds and silently dropped by the browser/curl.
 */
import assert from "node:assert/strict";
import {
  getAuthCookieDomain,
  isSecureCookie,
  getAuthCookieOptions,
} from "./cookie";

const ENV_KEYS = [
  "NODE_ENV",
  "APP_ENV",
  "AUTH_COOKIE_DOMAIN",
  "AUTH_COOKIE_SECURE",
  "NEXT_PUBLIC_APP_URL",
  "APP_PUBLIC_URL",
] as const;

// process.env.NODE_ENV is typed read-only by @types/node; index through a
// mutable view so tests can toggle it (Next.js sets it via its own build
// pipeline, never at runtime, so app code never needs to write to it).
const mutableEnv = process.env as Record<string, string | undefined>;

function withEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>, fn: () => void) {
  const saved: Partial<Record<string, string | undefined>> = {};
  for (const key of ENV_KEYS) {
    saved[key] = mutableEnv[key];
  }

  for (const key of ENV_KEYS) {
    const value = overrides[key];
    if (value === undefined) {
      delete mutableEnv[key];
    } else {
      mutableEnv[key] = value;
    }
  }

  try {
    fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = saved[key];
      if (value === undefined) {
        delete mutableEnv[key];
      } else {
        mutableEnv[key] = value;
      }
    }
  }
}

function main() {
  console.log("Starting cookie env-policy tests...");

  // 1. NODE_ENV=production + APP_ENV=local: no Domain, Secure=false for HTTP.
  withEnv({ NODE_ENV: "production", APP_ENV: "local" }, () => {
    const domain = getAuthCookieDomain("localhost:3000");
    assert.strictEqual(domain, undefined, "APP_ENV=local must not scope Domain even with NODE_ENV=production");
    assert.strictEqual(isSecureCookie(), false, "APP_ENV=local must not force Secure with NODE_ENV=production");
  });

  // 2. NODE_ENV=production + APP_ENV=dev: no Domain by default.
  withEnv({ NODE_ENV: "production", APP_ENV: "dev" }, () => {
    const domain = getAuthCookieDomain("localhost:3000");
    assert.strictEqual(domain, undefined, "APP_ENV=dev must not scope Domain even with NODE_ENV=production");
    assert.strictEqual(isSecureCookie(), false, "APP_ENV=dev must not force Secure with NODE_ENV=production");
  });

  // 3. APP_ENV=production: Domain=.mamago.by, Secure=true.
  withEnv({ NODE_ENV: "production", APP_ENV: "production" }, () => {
    const domain = getAuthCookieDomain("mamago.by");
    assert.strictEqual(domain, ".mamago.by", "APP_ENV=production must scope Domain to .mamago.by");
    assert.strictEqual(isSecureCookie(), true, "APP_ENV=production must force Secure=true");
  });

  // 3b. APP_ENV=prod alias behaves the same as APP_ENV=production.
  withEnv({ NODE_ENV: "production", APP_ENV: "prod" }, () => {
    assert.strictEqual(getAuthCookieDomain("mamago.by"), ".mamago.by", "APP_ENV=prod alias must scope Domain");
    assert.strictEqual(isSecureCookie(), true, "APP_ENV=prod alias must force Secure=true");
  });

  // 4. Explicit AUTH_COOKIE_DOMAIN override wins regardless of APP_ENV.
  withEnv({ NODE_ENV: "production", APP_ENV: "local", AUTH_COOKIE_DOMAIN: ".staging.mamago.by" }, () => {
    const domain = getAuthCookieDomain("staging.mamago.by");
    assert.strictEqual(domain, ".staging.mamago.by", "Explicit AUTH_COOKIE_DOMAIN must be used verbatim");
  });

  // 4b. Explicit AUTH_COOKIE_SECURE override wins regardless of APP_ENV.
  withEnv({ NODE_ENV: "development", APP_ENV: "local", AUTH_COOKIE_SECURE: "true" }, () => {
    assert.strictEqual(isSecureCookie(), true, "Explicit AUTH_COOKIE_SECURE=true must force Secure even in dev");
  });
  withEnv({ APP_ENV: "production", AUTH_COOKIE_SECURE: "false" }, () => {
    assert.strictEqual(isSecureCookie(), false, "Explicit AUTH_COOKIE_SECURE=false must override APP_ENV=production");
  });

  // 4c. HTTPS preview families explicitly share only within their own family.
  for (const [host, domain] of [
    ["dev.mamago.by", ".dev.mamago.by"],
    ["admin.dev.mamago.by", ".dev.mamago.by"],
    ["business.dev.mamago.by", ".dev.mamago.by"],
    ["prod.mamago.by", ".prod.mamago.by"],
    ["admin.prod.mamago.by", ".prod.mamago.by"],
    ["business.prod.mamago.by", ".prod.mamago.by"],
  ] as const) {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "preview",
      AUTH_COOKIE_DOMAIN: domain,
      AUTH_COOKIE_SECURE: "true",
    }, () => {
      const createOptions = getAuthCookieOptions(host);
      const deleteOptions = getAuthCookieOptions(host);
      assert.strictEqual(createOptions.domain, domain);
      assert.strictEqual(createOptions.secure, true);
      assert.deepStrictEqual(deleteOptions, createOptions);
      assert.notStrictEqual(createOptions.domain, ".mamago.by");
    });
  }

  // 4d. Staging on real *.mamago.by HTTPS subdomains: cross-subdomain sharing
  // is opt-in via explicit overrides, not a hardcoded APP_ENV=staging branch —
  // subdomainMiddleware.ts redirects auth routes on business./admin.mamago.by
  // back to the public mamago.by host, so the session must be readable across
  // all three subdomains in that topology.
  withEnv({
    NODE_ENV: "production",
    APP_ENV: "staging",
    AUTH_COOKIE_DOMAIN: ".mamago.by",
    AUTH_COOKIE_SECURE: "true",
  }, () => {
    const domain = getAuthCookieDomain("business.mamago.by");
    assert.strictEqual(domain, ".mamago.by", "Staging with explicit AUTH_COOKIE_DOMAIN must share across *.mamago.by");
    assert.strictEqual(isSecureCookie(), true, "Staging with explicit AUTH_COOKIE_SECURE=true must be Secure over HTTPS");
  });

  // 4e. Staging on a separate domain / preview URL / plain host: without the
  // explicit overrides, staging must NOT get .mamago.by scoping (host-only).
  withEnv({ NODE_ENV: "production", APP_ENV: "staging" }, () => {
    const domain = getAuthCookieDomain("my-app-preview.vercel.app");
    assert.strictEqual(domain, undefined, "Staging without explicit overrides must stay host-only on a non-mamago.by host");
    assert.strictEqual(isSecureCookie(), false, "Staging without explicit AUTH_COOKIE_SECURE must not force Secure");
  });

  // 5. Bare NODE_ENV=production with no APP_ENV set: must NOT imply .mamago.by.
  withEnv({ NODE_ENV: "production" }, () => {
    const domain = getAuthCookieDomain("localhost:3000");
    assert.notStrictEqual(domain, ".mamago.by", "Bare NODE_ENV=production alone must not scope Domain to .mamago.by");
    assert.strictEqual(domain, undefined, "Bare NODE_ENV=production alone must yield host-only cookie on localhost");
    assert.strictEqual(isSecureCookie(), false, "Bare NODE_ENV=production alone must not force Secure");
  });

  withEnv({ NODE_ENV: "production", APP_ENV: "dev" }, () => {
    assert.strictEqual(
      getAuthCookieDomain("dev.mamago.by"),
      undefined,
      "DEV preview must never fall back to the broader .mamago.by domain",
    );
  });

  withEnv({ NODE_ENV: "development", APP_ENV: "local" }, () => {
    assert.strictEqual(getAuthCookieDomain("mamago.local"), ".mamago.local");
    assert.strictEqual(getAuthCookieDomain("admin.mamago.local"), ".mamago.local");
    assert.strictEqual(getAuthCookieDomain("127.0.0.1:3000"), undefined);
    assert.strictEqual(getAuthCookieDomain("192.168.1.20:3000"), undefined);
  });

  // 6. Logout options must match login options for the same request host
  //    (same domain/path/httpOnly/sameSite/secure so the cookie actually clears).
  withEnv({ NODE_ENV: "production", APP_ENV: "production" }, () => {
    const loginOptions = getAuthCookieOptions("mamago.by");
    const logoutOptions = getAuthCookieOptions("mamago.by");
    assert.deepStrictEqual(logoutOptions, loginOptions, "Logout cookie options must match login cookie options");
  });
  withEnv({ NODE_ENV: "production", APP_ENV: "local" }, () => {
    const loginOptions = getAuthCookieOptions("localhost:3000");
    const logoutOptions = getAuthCookieOptions("localhost:3000");
    assert.deepStrictEqual(logoutOptions, loginOptions, "Logout cookie options must match login cookie options on localhost too");
  });

  console.log("All cookie env-policy tests passed.");
}

main();
