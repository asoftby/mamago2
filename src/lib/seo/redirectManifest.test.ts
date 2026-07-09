/**
 * Tests for the redirect-manifest loader/validator.
 * Run: pnpm test:redirect-manifest (tsx, assert-based — project convention).
 *
 * Uses a synthetic fixture manifest written to a temp dir; never touches the
 * repo's manifest.csv.
 */

import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  loadRedirectManifest,
  type AllowedSections,
  type LoadRedirectManifestOptions,
} from "./redirectManifest";

const tempDir = mkdtempSync(join(tmpdir(), "redirect-manifest-test-"));

// Mirrors the real routing tree (src/app/(public) and (public)/[city]) —
// kept static here so the test is hermetic.
const ALLOWED: AllowedSections = {
  rootSections: ["blog", "places", "offers", "legal", "page", "routes", "ideas", "search"],
  citySections: [
    "activity", "birthday", "blog", "classes", "events", "kuda",
    "offers", "places", "programs", "routes", "tags", "where-to-go",
  ],
};

const HEADER = "rule_type,old_url,new_url,entity_type,entity_id,notes";
const BASE = "https://mamago.by";

function row(ruleType: string, oldPath: string, newPath: string): string {
  const oldUrl = oldPath ? `${BASE}${oldPath}` : "";
  const newUrl = newPath ? `${BASE}${newPath}` : "";
  return `${ruleType},${oldUrl},${newUrl},article,id-x,test row`;
}

function writeManifest(name: string, rows: string[]): string {
  const path = join(tempDir, name);
  writeFileSync(path, [HEADER, ...rows].join("\n") + "\n", "utf8");
  return path;
}

function load(
  manifestPath: string,
  overrides: Partial<LoadRedirectManifestOptions> = {},
) {
  const warnings: string[] = [];
  const result = loadRedirectManifest({
    manifestPath,
    require: false,
    minRows: 0,
    allowedSections: ALLOWED,
    warn: (m) => warnings.push(m),
    ...overrides,
  });
  return { ...result, warnings };
}

// ─── 1. Happy path: representative manifest rows resolve to expected rules ───

const happyPath = writeManifest("happy.csv", [
  // canonical rows are targets, not redirects — must be ignored
  row("canonical", "", "/minsk/blog/best-playgrounds"),
  // WP journal article → city-first blog
  row("wp_journal", "/journal/best-playgrounds", "/minsk/blog/best-playgrounds"),
  // WP journal article → national blog
  row("wp_journal", "/journal/child-benefits-2025", "/blog/child-benefits-2025"),
  // slug history: renamed city blog post
  row("slug_history", "/minsk/blog/old-title", "/minsk/blog/new-title"),
  // slug history: renamed national post
  row("slug_history", "/blog/old-guide", "/blog/new-guide"),
  // events section for a city
  row("wp_journal", "/journal/kids-events-digest", "/minsk/events"),
  // place page
  row("wp_journal", "/journal/dino-park-review", "/places/dino-park"),
  // offers section
  row("wp_journal", "/journal/birthday-offers", "/minsk/offers"),
  // city hub
  row("wp_journal", "/journal/minsk-guide", "/minsk"),
  // homepage target
  row("wp_journal", "/journal/about-relaunch", "/"),
  // quoted CSV field with embedded comma must survive parsing
  `wp_journal,${BASE}/journal/with-comma,${BASE}/minsk/blog/with-comma,article,id-q,"notes, with comma"`,
  // static WP redirect map row (root-level WP article → city blog)
  row("wp_map", "/wp-legacy-article", "/minsk/blog/wp-legacy-article"),
]);

{
  const { rules, issues, totalRedirectRows } = load(happyPath);
  assert.equal(issues.length, 0, `unexpected issues: ${JSON.stringify(issues)}`);
  assert.equal(totalRedirectRows, 11);
  assert.equal(rules.length, 11);

  const byda = new Map(rules.map((r) => [r.source, r]));
  assert.deepEqual(byda.get("/journal/best-playgrounds"), {
    source: "/journal/best-playgrounds",
    destination: "/minsk/blog/best-playgrounds",
    permanent: true, // permanent → Next.js serves 308 (Google: permanent, equity transfers)
  });
  assert.equal(byda.get("/journal/child-benefits-2025")?.destination, "/blog/child-benefits-2025");
  assert.equal(byda.get("/minsk/blog/old-title")?.destination, "/minsk/blog/new-title");
  assert.equal(byda.get("/blog/old-guide")?.destination, "/blog/new-guide");
  assert.equal(byda.get("/journal/kids-events-digest")?.destination, "/minsk/events");
  assert.equal(byda.get("/journal/dino-park-review")?.destination, "/places/dino-park");
  assert.equal(byda.get("/journal/minsk-guide")?.destination, "/minsk");
  assert.equal(byda.get("/journal/about-relaunch")?.destination, "/");
  assert.equal(byda.get("/journal/with-comma")?.destination, "/minsk/blog/with-comma");
  assert.equal(byda.get("/wp-legacy-article")?.destination, "/minsk/blog/wp-legacy-article");
  // every manifest rule must be a permanent (308) redirect
  assert.ok(rules.every((r) => r.permanent === true));
}

// ─── 2. Missing file ─────────────────────────────────────────────────────────

{
  const missing = join(tempDir, "does-not-exist.csv");
  const { rules, issues } = load(missing);
  assert.equal(rules.length, 0);
  assert.equal(issues[0]?.kind, "missing-file");

  assert.throws(
    () => load(missing, { require: true }),
    /manifest.*not found/i,
    "require mode must throw on missing manifest",
  );
}

// ─── 3. Below-threshold row count ────────────────────────────────────────────

{
  const small = writeManifest("small.csv", [
    row("wp_journal", "/journal/only-one", "/minsk/blog/only-one"),
  ]);
  const { issues } = load(small, { minRows: 900 });
  assert.equal(issues[0]?.kind, "below-threshold");

  assert.throws(
    () => load(small, { require: true, minRows: 900 }),
    /Only 1 redirect rows/,
    "require mode must throw below the row threshold",
  );
  // threshold counts redirect rows only — canonical rows must not help pass it
  const paddedWithCanonical = writeManifest("padded.csv", [
    row("wp_journal", "/journal/only-one", "/minsk/blog/only-one"),
    row("canonical", "", "/minsk/blog/a"),
    row("canonical", "", "/minsk/blog/b"),
  ]);
  assert.throws(() => load(paddedWithCanonical, { require: true, minRows: 2 }));
}

// ─── 4. Duplicate sources ────────────────────────────────────────────────────

{
  // identical duplicate → deduped silently
  const dupSame = writeManifest("dup-same.csv", [
    row("wp_journal", "/journal/a", "/minsk/blog/a"),
    row("wp_journal", "/journal/a", "/minsk/blog/a"),
  ]);
  const same = load(dupSame);
  assert.equal(same.issues.length, 0);
  assert.equal(same.rules.length, 1);

  // conflicting destinations → error, both dropped in lenient mode
  const dupConflict = writeManifest("dup-conflict.csv", [
    row("wp_journal", "/journal/a", "/minsk/blog/a"),
    row("wp_journal", "/journal/a", "/minsk/blog/other"),
  ]);
  const conflict = load(dupConflict);
  assert.equal(conflict.issues[0]?.kind, "duplicate-source");
  assert.equal(conflict.rules.length, 0);
  assert.throws(() => load(dupConflict, { require: true }), /duplicate source/);
}

// ─── 5. Cycles and self-redirects ────────────────────────────────────────────

{
  const selfRedirect = writeManifest("self.csv", [
    row("slug_history", "/blog/same", "/blog/same"),
  ]);
  const self = load(selfRedirect);
  assert.equal(self.issues[0]?.kind, "self-redirect");
  assert.equal(self.rules.length, 0);

  const cycle = writeManifest("cycle.csv", [
    row("slug_history", "/blog/a", "/blog/b"),
    row("slug_history", "/blog/b", "/blog/a"),
    row("wp_journal", "/journal/ok", "/minsk/blog/ok"), // untouched by the cycle
  ]);
  const cycled = load(cycle);
  assert.ok(cycled.issues.some((i) => i.kind === "cycle"), "cycle must be reported");
  assert.deepEqual(
    cycled.rules.map((r) => r.source),
    ["/journal/ok"],
    "cycle members dropped, healthy rule kept",
  );
  assert.throws(() => load(cycle, { require: true }), /redirect cycle/);

  // longer chain a→b→c→a
  const longCycle = writeManifest("cycle3.csv", [
    row("slug_history", "/blog/a", "/blog/b"),
    row("slug_history", "/blog/b", "/blog/c"),
    row("slug_history", "/blog/c", "/blog/a"),
  ]);
  const long = load(longCycle);
  assert.ok(long.issues.some((i) => i.kind === "cycle"));
  assert.equal(long.rules.length, 0);
}

// ─── 6. Destination scheme validation ────────────────────────────────────────

{
  const badScheme = writeManifest("bad-scheme.csv", [
    // destination still on the OLD WordPress scheme — must be flagged
    row("wp_journal", "/journal/a", "/journal/a-new"),
    // unknown root section
    row("wp_journal", "/journal/b", "/wp-content/uploads/b"),
    // city-first but unknown city section
    row("wp_journal", "/journal/c", "/minsk/unknown-section/c"),
    // invalid city slug shape (uppercase)
    row("wp_journal", "/journal/d", "/MINSK/blog/d"),
    // valid rows for contrast
    row("wp_journal", "/journal/e", "/minsk/where-to-go"),
    row("wp_journal", "/journal/f", "/legal/privacy"),
  ]);
  const scheme = load(badScheme);
  const schemeIssues = scheme.issues.filter((i) => i.kind === "unknown-destination-section");
  assert.equal(schemeIssues.length, 4, JSON.stringify(scheme.issues, null, 2));
  assert.deepEqual(
    scheme.rules.map((r) => r.destination).sort(),
    ["/legal/privacy", "/minsk/where-to-go"],
  );
  assert.throws(() => load(badScheme, { require: true }), /new URL scheme/);
}

// ─── 7. Trailing slash destination ───────────────────────────────────────────

{
  const trailing = writeManifest("trailing.csv", [
    row("wp_journal", "/journal/a", "/minsk/blog/a/"),
    row("wp_journal", "/journal/b", "/minsk/blog/b"),
  ]);
  const t = load(trailing);
  assert.equal(t.issues[0]?.kind, "trailing-slash");
  assert.equal(t.rules.length, 1);
  assert.throws(() => load(trailing, { require: true }), /trailing slash/);
}

// ─── 8. Unparseable URLs ─────────────────────────────────────────────────────

{
  const badUrl = writeManifest("bad-url.csv", [
    "wp_journal,not-a-url,also-not-a-url,article,id-1,broken row",
    row("wp_journal", "/journal/ok", "/minsk/blog/ok"),
  ]);
  const b = load(badUrl);
  assert.equal(b.issues[0]?.kind, "bad-path");
  assert.equal(b.rules.length, 1);
}

rmSync(tempDir, { recursive: true, force: true });
console.log("redirectManifest.test.ts: all assertions passed");
