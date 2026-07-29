/**
 * Regression/contract tests for the global noindex switch — the one flag
 * that drives meta robots (applyGlobalRobotsOverride), robots.txt, and the
 * X-Robots-Tag response header (src/middleware.ts). All three must agree
 * with `isGlobalNoindexEnabled()`, since a mismatch between meta robots and
 * X-Robots-Tag is a hard-gate violation for SEO closure.
 *
 * Each scenario runs in its own subprocess so env vars can't leak between
 * cases via module-level caching.
 *
 * Запуск: npx tsx src/lib/seo/globalNoindex.test.ts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = path.join(__dirname, "globalNoindex.ts");

interface ProbeResult {
  isGlobalNoindexEnabled: boolean;
  metaRobotsIsNoindex: boolean;
}

function probe(env: Record<string, string | undefined>): ProbeResult {
  const script = `
    import { isGlobalNoindexEnabled, applyGlobalRobotsOverride, GLOBAL_NOINDEX_ROBOTS } from ${JSON.stringify(MODULE_PATH)};
    const result = applyGlobalRobotsOverride({ title: "x", robots: { index: true, follow: true } });
    console.log(JSON.stringify({
      isGlobalNoindexEnabled: isGlobalNoindexEnabled(),
      metaRobotsIsNoindex: result.robots === GLOBAL_NOINDEX_ROBOTS,
    }));
  `;
  const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
  delete cleanEnv.SITE_NOINDEX_FORCE;
  delete cleanEnv.SITE_NOINDEX_DEFAULT;
  delete cleanEnv.SITE_INDEXING_ENABLED;
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) cleanEnv[k] = v;
  }
  const out = execFileSync("npx", ["tsx", "--eval", script], {
    cwd: path.join(__dirname, "..", "..", ".."),
    env: cleanEnv,
    encoding: "utf8",
  });
  return JSON.parse(out.trim().split("\n").pop()!);
}

function testDefaultsToNoindexWithNoEnvSet() {
  const result = probe({});
  assert.equal(result.isGlobalNoindexEnabled, true, "prelaunch default must be noindex=true");
}

function testSiteIndexingEnabledTurnsIndexingOn() {
  const result = probe({ SITE_INDEXING_ENABLED: "true" });
  assert.equal(result.isGlobalNoindexEnabled, false);
}

function testForceOverridesIndexingEnabled() {
  const result = probe({ SITE_NOINDEX_FORCE: "true", SITE_INDEXING_ENABLED: "true" });
  assert.equal(
    result.isGlobalNoindexEnabled,
    true,
    "SITE_NOINDEX_FORCE must win even if SITE_INDEXING_ENABLED=true (kill switch)",
  );
}

function testExplicitDefaultFlagIsNoindex() {
  const result = probe({ SITE_NOINDEX_DEFAULT: "true" });
  assert.equal(result.isGlobalNoindexEnabled, true);
}

function testMetaRobotsAndXRobotsTagNeverContradict() {
  // Both robots.ts and middleware.ts derive their decision from the exact
  // same isGlobalNoindexEnabled() call — this test locks that invariant so
  // a future edit can't make meta robots respect an env var that
  // X-Robots-Tag (or vice versa) ignores.
  for (const env of [
    { SITE_NOINDEX_FORCE: "true" },
    { SITE_INDEXING_ENABLED: "true" },
    { SITE_NOINDEX_DEFAULT: "true" },
    {},
  ]) {
    const result = probe(env);
    assert.equal(
      result.metaRobotsIsNoindex,
      result.isGlobalNoindexEnabled,
      `meta robots vs X-Robots-Tag flag disagree for ${JSON.stringify(env)}`,
    );
  }
}

testDefaultsToNoindexWithNoEnvSet();
testSiteIndexingEnabledTurnsIndexingOn();
testForceOverridesIndexingEnabled();
testExplicitDefaultFlagIsNoindex();
testMetaRobotsAndXRobotsTagNeverContradict();

console.log("globalNoindex tests: OK");
