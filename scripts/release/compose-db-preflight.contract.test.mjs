import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const src = readFileSync(new URL("./compose-db-preflight.sh", import.meta.url), "utf8");
test("shell syntax and read-only DB contract", () => {
  const check = spawnSync("bash", ["-n"], { input: src, encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr);
  assert.match(src, /APP_VERSION="\$tag" docker compose -p "\$project" config --format json/);
  assert.match(src, /"\$db_id"/);
  assert.match(src, /"\$db_started"/);
  assert.doesNotMatch(src, /docker compose[^\n]*\b(?:up|down|run|rm|restart)\b/);
});
const script = src.match(/python3 - "\$project" "\$tag" "\$scratch\/before\.json" "\$scratch\/after\.json" <<'PY'\n([\s\S]*?)\nPY/);
assert.ok(script, "inline Python comparer must remain covered by tests");

function checkVersions(oldConfig, newConfig) {
  const dir = mkdtempSync(join(tmpdir(), "mamago-compose-gate-test-"));
  try {
    const a = join(dir, "before.json");
    const b = join(dir, "after.json");
    writeFileSync(a, JSON.stringify(oldConfig));
    writeFileSync(b, JSON.stringify(newConfig));
    return spawnSync("python3", ["-", "prod", "prod-1069", a, b], {
      input: script[1],
      encoding: "utf8",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const app = tag => ({ image: `ghcr.io/asoftby/mamago2:${tag}` });
const initial = { services: { db: { image: "postgres:16", volumes: ["prod_data:/var/lib/postgresql/data"] }, app: app("prod-1051"), worker: app("prod-1051"), migrate: app("prod-1051") } };
const target = { services: { ...initial.services, app: app("prod-1069"), worker: app("prod-1069"), migrate: app("prod-1069") } };
test("updating only application images leaves database config invariant", () => {
  const r = checkVersions(initial, target);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /COMPOSE_DB_CONFIG_SAFE/);
});
test("rejects new DB config, volumes and dependent image drift", () => {
  for (const candidate of [
    { ...target, services: { ...target.services, db: { image: "postgres:17" } } },
    { ...target, services: { ...target.services, db: { ...target.services.db, volumes: ["new_volume:/var/lib/postgresql/data"] } } },
    { ...target, services: { ...target.services, worker: app("prod-1051") } },
    { ...target, services: { ...target.services, migrate: app("dev-1069") } },
    { ...target, services: { ...target.services, db: undefined } },
  ]) {
    assert.notEqual(checkVersions(initial, candidate).status, 0);
  }
});
