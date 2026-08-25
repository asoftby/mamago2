/**
 * Pure decision-rule tests for the PAGE_VIEW route observer.
 * Запуск: npx tsx src/lib/analytics/pageViewObserver.test.ts
 */
import assert from "node:assert/strict";
import { isPublicPageViewPath, shouldEmitPageView } from "./pageViewObserver";

/**
 * Mirrors PageViewTracker's own composition of the two guards (same order,
 * same "don't touch `last` on a blocked path" behavior) so the leak fix and
 * its cross-navigation sequencing can be tested without mounting React —
 * this repo's tests run as plain tsx scripts, not RTL.
 */
function decide(last: string | null, pathname: string): { emit: boolean; last: string | null } {
  if (!isPublicPageViewPath(pathname)) return { emit: false, last };
  if (!shouldEmitPageView(last, pathname)) return { emit: false, last };
  return { emit: true, last: pathname };
}

function main() {
  assert.equal(
    shouldEmitPageView(null, "/minsk/events"),
    true,
    "initial mount (no previous pathname) must emit",
  );
  assert.equal(
    shouldEmitPageView("/minsk/events", "/minsk/places"),
    true,
    "navigation to a different pathname must emit",
  );
  assert.equal(
    shouldEmitPageView("/minsk/events", "/minsk/events"),
    false,
    "re-render with the same pathname must not emit (no dup)",
  );

  // usePathname() never includes the query string, so a query-only change
  // is represented as the SAME pathname argument twice — already covered
  // by the same-pathname case above, which is the mechanism (not a special
  // case) that satisfies the "no dup on query-only change" rule.

  // --- isPublicPageViewPath: public surface (audited against src/app/*) ---
  assert.equal(isPublicPageViewPath("/"), true, "site root must emit");
  assert.equal(isPublicPageViewPath("/minsk"), true, "city hub must emit");
  assert.equal(
    isPublicPageViewPath("/minsk/events/s-kibirova-balet-tri-porosenka"),
    true,
    "public event detail route must emit",
  );
  assert.equal(isPublicPageViewPath("/minsk/places/some-place"), true, "public place route must emit");
  assert.equal(isPublicPageViewPath("/minsk/offers/some-offer"), true, "public offer route must emit");
  assert.equal(
    isPublicPageViewPath("/minsk/blog/some-article"),
    true,
    "public article/blog route must emit",
  );
  assert.equal(isPublicPageViewPath("/me"), true, "/me lives inside (public) and stays tracked");
  assert.equal(isPublicPageViewPath("/me/saved"), true, "/me/* lives inside (public) and stays tracked");

  // --- isPublicPageViewPath: confirmed leak surface ---
  assert.equal(isPublicPageViewPath("/admin"), false, "/admin must never emit");
  assert.equal(
    isPublicPageViewPath("/admin/events/cmt7ldq4z001dt401oc6qu9zc"),
    false,
    "/admin/* must never emit (the reproduced leak path)",
  );
  assert.equal(isPublicPageViewPath("/business"), false, "/business must never emit");
  assert.equal(isPublicPageViewPath("/business/anything"), false, "/business/* must never emit");

  // --- isPublicPageViewPath: other non-public top-level segments from the route audit ---
  for (const path of [
    "/account",
    "/settings",
    "/u/some-token",
    "/n/some-id",
    "/identity/filters",
    "/invite/business",
    "/profile-entry",
    "/business-entry",
    "/auth",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/activate",
    "/ui-lab",
    "/ui-lab-admin",
    "/editor",
    "/api/analytics/events",
    "/actions/logout",
  ]) {
    assert.equal(isPublicPageViewPath(path), false, `${path} must never emit (non-public surface)`);
  }

  // --- cross-navigation sequencing (mirrors PageViewTracker's composed guard) ---
  let state = decide(null, "/minsk/events");
  assert.equal(state.emit, true, "initial public mount emits");

  state = decide(state.last, "/admin/events/abc");
  assert.equal(state.emit, false, "navigation public -> admin does not emit the admin path");
  assert.equal(state.last, "/minsk/events", "blocked admin path must not become the tracked `last`");

  // Real navigation into /admin/private unmounts PageViewTracker; the next
  // mount inside the public shell starts a fresh component instance with
  // `last = null`, which is what actually happens on remount — simulated
  // here by resetting state instead of reusing the blocked `state.last`.
  state = decide(null, "/minsk/places/some-place");
  assert.equal(state.emit, true, "navigation admin/private -> public starts normal public tracking");

  state = decide(state.last, "/minsk/places/some-place");
  assert.equal(state.emit, false, "same pathname duplicate remains suppressed");

  console.log("pageViewObserver.test.ts: OK");
}

main();
