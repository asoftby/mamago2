/**
 * The mock seed must be unable to run outside DEV: with APP_ENV=production (or anything that is
 * not dev/local) the process exits with code 2 BEFORE any database connection is attempted.
 * Proven end-to-end: the seed is spawned against a TCP listener standing in for the database and
 * the listener must record zero connections.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, type AddressInfo } from "node:net";
import { refusalReason } from "../seed-day-scenario-mocks";

const SCRIPT = "scripts/ops/seed-day-scenario-mocks.ts";

// APP_ENV allow-list: everything that is not dev/development/local/test is refused, in any spelling.
for (const appEnv of ["production", "PRODUCTION", " Production ", "prod", "staging", "preview", "", "devv"]) {
  const reason = refusalReason({ APP_ENV: appEnv, DATABASE_URL: "postgresql://u:p@localhost:5432/x" }, "localhost");
  assert.match(reason ?? "", /DEV-only/, `APP_ENV="${appEnv}" must be refused`);
}

async function runSeed(flag: string, env: Record<string, string>): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn("node_modules/.bin/tsx", [SCRIPT, flag, "--confirm-host=127.0.0.1"], {
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env },
    });
    let out = "";
    child.stdout.on("data", (c) => (out += c));
    child.stderr.on("data", (c) => (out += c));
    child.on("close", (code) => resolve({ code, out }));
  });
}

async function main(): Promise<void> {
  let connections = 0;
  const server = createServer((socket) => {
    connections += 1;
    socket.destroy();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as AddressInfo).port;
  const databaseUrl = `postgresql://u:p@127.0.0.1:${port}/x`;

  for (const flag of ["--apply", "--check", "--cleanup"]) {
    for (const appEnv of ["production", undefined]) {
      const env: Record<string, string> = { DATABASE_URL: databaseUrl };
      if (appEnv) env.APP_ENV = appEnv;
      const { code, out } = await runSeed(flag, env);
      assert.equal(code, 2, `${flag} with APP_ENV=${appEnv ?? "unset"} must exit with code 2: ${out}`);
      assert.match(out, /MOCK_SEED REFUSED/, `${flag}: refusal message expected`);
    }
  }
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(connections, 0, "a refused run must not open any database connection");

  // control: with APP_ENV=dev the very same run does reach the database (proves the listener would see it)
  const control = await runSeed("--check", { DATABASE_URL: databaseUrl, APP_ENV: "dev" });
  assert.notEqual(control.code, 2, `control run must not be refused: ${control.out}`);
  assert.ok(connections > 0, "control run is expected to try the database");

  await new Promise((r) => server.close(r));
  console.log("day-scenario mock seed refusal e2e passed");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
