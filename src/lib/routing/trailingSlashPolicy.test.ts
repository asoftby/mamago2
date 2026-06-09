/**
 * Unit tests for the no-trailing-slash URL policy helpers.
 * Run with: npx tsx src/lib/routing/trailingSlashPolicy.test.ts
 */
import assert from "node:assert/strict";

import {
  shouldSkipTrailingSlashRedirect,
  removeTrailingSlash,
} from "./trailingSlashPolicy";

// ── removeTrailingSlash ───────────────────────────────────────────────────────

assert.equal(removeTrailingSlash("/"),             "/",             "root stays /");
assert.equal(removeTrailingSlash("/minsk"),        "/minsk",        "no-op when clean");
assert.equal(removeTrailingSlash("/minsk/"),       "/minsk",        "removes trailing /");
assert.equal(removeTrailingSlash("/minsk/events/"), "/minsk/events", "nested path");
assert.equal(
  removeTrailingSlash("/minsk/events//"),
  "/minsk/events",
  "collapses multiple trailing slashes",
);

// ── shouldSkipTrailingSlashRedirect ──────────────────────────────────────────

// Root must NOT be redirected
assert.equal(shouldSkipTrailingSlashRedirect("/"),       true,  "root /");

// API routes must NOT be redirected
assert.equal(shouldSkipTrailingSlashRedirect("/api"),          true,  "/api exact");
assert.equal(shouldSkipTrailingSlashRedirect("/api/auth/me"),  true,  "/api/auth/me");
assert.equal(shouldSkipTrailingSlashRedirect("/api/auth/me/"), true,  "/api/auth/me/");
assert.equal(shouldSkipTrailingSlashRedirect("/api/test/"),    true,  "/api/ prefix");

// Next internals must NOT be redirected
assert.equal(shouldSkipTrailingSlashRedirect("/_next/static/chunk.js"), true, "/_next/ prefix");
assert.equal(shouldSkipTrailingSlashRedirect("/_next/image"),           true, "/_next/image");

// Sentry tunnel must NOT be redirected
assert.equal(shouldSkipTrailingSlashRedirect("/monitoring"),      true,  "/monitoring");
assert.equal(shouldSkipTrailingSlashRedirect("/monitoring/sentry"), true, "/monitoring/...");

// Static file extensions must NOT be redirected
assert.equal(shouldSkipTrailingSlashRedirect("/favicon.ico"),            true,  ".ico");
assert.equal(shouldSkipTrailingSlashRedirect("/robots.txt"),             true,  ".txt");
assert.equal(shouldSkipTrailingSlashRedirect("/sitemap.xml"),            true,  ".xml");
assert.equal(shouldSkipTrailingSlashRedirect("/manifest.webmanifest"),   true,  ".webmanifest");
assert.equal(shouldSkipTrailingSlashRedirect("/images/logo.png"),        true,  ".png");
assert.equal(shouldSkipTrailingSlashRedirect("/assets/style.css"),       true,  ".css");

// Public routes WITH trailing slash SHOULD be redirected (skip = false)
assert.equal(shouldSkipTrailingSlashRedirect("/minsk/"),              false, "/minsk/");
assert.equal(shouldSkipTrailingSlashRedirect("/minsk/events/"),       false, "/minsk/events/");
assert.equal(shouldSkipTrailingSlashRedirect("/minsk/blog/test/"),    false, "/minsk/blog/test/");
assert.equal(shouldSkipTrailingSlashRedirect("/blog/article/"),       false, "/blog/article/");

// ── redirect target: query string preserved ──────────────────────────────────
// (simulated: middleware uses URL API, which preserves search params automatically;
//  we just verify the path normalisation is correct)

assert.equal(removeTrailingSlash("/minsk/events/"), "/minsk/events");
// In the actual middleware, `redirectUrl.search` is preserved from the original URL,
// so /minsk/events/?age=3 → redirectUrl.pathname=/minsk/events + search=?age=3

console.log("✅ trailingSlashPolicy.test.ts — all assertions passed");
