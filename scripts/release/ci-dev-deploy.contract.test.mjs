import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const sha = "a".repeat(40);
const url = "https://dev.mamago.by/api/health";
const script = "scripts/release/verify-dev-runtime.mjs";
function checkHealth(response) {
  const prelude = "globalThis.fetch=async()=>({ok:true,json:async()=>(" + JSON.stringify(response) + ")})";
  return spawnSync(process.execPath, [
    "--import", "data:text/javascript," + encodeURIComponent(prelude),
    script, url, sha, "dev-100",
  ], { encoding: "utf8" });
}
test("exact DEV SHA/build/health succeeds", () => {
  const result = checkHealth({status:"ok",db:"ok",gitSha:sha,buildId:"dev-100"});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DEV_PARITY_OK/);
});
test("stale SHA fails closed", () => {
  const result = checkHealth({status:"ok",db:"ok",gitSha:"b".repeat(40),buildId:"dev-100"});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /DEV_PARITY_FAILED/);
});
test("stale build fails closed", () => {
  const result = checkHealth({status:"ok",db:"ok",gitSha:sha,buildId:"dev-99"});
  assert.equal(result.status, 1);
});
test("unhealthy DB fails closed", () => {
  const result = checkHealth({status:"ok",db:"unavailable",gitSha:sha,buildId:"dev-100"});
  assert.equal(result.status, 1);
});
test("unauthorized health URL rejected without fetch", () => {
  const result = spawnSync(process.execPath, [script,"https://prod.mamago.by/api/health",sha,"dev-100"], {encoding:"utf8"});
  assert.equal(result.status, 2);
});
test("auto-deploy is opt-in and never cancels in-flight migrations", () => {
  const workflow=readFileSync(".github/workflows/docker.yml","utf8");
  assert.match(workflow,/vars.MAMAGO_AUTO_DEPLOY_DEV == 'true'/);
  assert.match(workflow,/group: mamago-dev-auto-deploy\s+cancel-in-progress: false/);
  assert.match(workflow,/Preserve encrypted database backup[\s\S]*?Apply target-image migrations/);
  const host=readFileSync("scripts/release/ci-dev-host-deploy.sh","utf8");
  assert.match(host,/\/opt\/mamago\/dev/);
  assert.match(host,/docker compose -p dev run --rm --no-deps migrate/);
  assert.match(host,/docker compose -p dev up -d --no-deps app worker/);
  assert.doesNotMatch(host,/docker compose.*\bdown\b/);
});
