import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, resolveCodeSha } from "./migration-phoenix-release";

const VALID_SHA = "559240d77b36bada507318a35ffaf3ad442056de";
const OTHER_VALID_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

function enoent(): never {
  const error = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
  error.code = "ENOENT";
  throw error;
}

function eacces(): never {
  const error = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
  error.code = "EACCES";
  throw error;
}

function testValidBakedShaIsReturned() {
  const result = resolveCodeSha({
    readBakedFile: () => `${VALID_SHA}\n`,
    gitRevParseHead: () => {
      throw new Error("git must not be invoked when the baked file exists");
    },
  });
  assert.equal(result, VALID_SHA);
}

function testGitNotInvokedWhenBakedFileExists() {
  let gitCalled = false;
  const result = resolveCodeSha({
    readBakedFile: () => OTHER_VALID_SHA,
    gitRevParseHead: () => {
      gitCalled = true;
      return VALID_SHA;
    },
  });
  assert.equal(result, OTHER_VALID_SHA);
  assert.equal(gitCalled, false);
}

function testMissingBakedFileFallsBackToValidGitSha() {
  const result = resolveCodeSha({
    readBakedFile: enoent,
    gitRevParseHead: () => `${VALID_SHA}\n`,
  });
  assert.equal(result, VALID_SHA);
}

function testMalformedBakedShaFailsClosedWithoutGitFallback() {
  let gitCalled = false;
  assert.throws(
    () =>
      resolveCodeSha({
        readBakedFile: () => "not-a-real-sha",
        gitRevParseHead: () => {
          gitCalled = true;
          return VALID_SHA;
        },
      }),
    /CODE_SHA_INVALID/,
  );
  assert.equal(gitCalled, false);
}

function testEmptyBakedShaFailsClosedWithoutGitFallback() {
  let gitCalled = false;
  assert.throws(
    () =>
      resolveCodeSha({
        readBakedFile: () => "\n",
        gitRevParseHead: () => {
          gitCalled = true;
          return VALID_SHA;
        },
      }),
    /CODE_SHA_INVALID/,
  );
  assert.equal(gitCalled, false);
}

function testUnreadableBakedFileFailsClosedWithoutGitFallback() {
  let gitCalled = false;
  assert.throws(
    () =>
      resolveCodeSha({
        readBakedFile: eacces,
        gitRevParseHead: () => {
          gitCalled = true;
          return VALID_SHA;
        },
      }),
    /CODE_SHA_BAKED_FILE_UNREADABLE/,
  );
  assert.equal(gitCalled, false);
}

function testMalformedGitOutputFails() {
  assert.throws(
    () =>
      resolveCodeSha({
        readBakedFile: enoent,
        gitRevParseHead: () => "not-a-sha",
      }),
    /CODE_SHA_INVALID/,
  );
}

function testNeitherSourceAvailableProducesClearFailure() {
  assert.throws(
    () =>
      resolveCodeSha({
        readBakedFile: enoent,
        gitRevParseHead: () => {
          throw new Error("spawnSync git ENOENT");
        },
      }),
    /CODE_SHA_UNAVAILABLE/,
  );
}

const BASE_ARGV = ["--environment", "DEV", "--manifest", "manifest.json", "--apply"];

function testContinuationFlagsRequireAllThreeTogether() {
  assert.throws(
    () => parseArgs([...BASE_ARGV, "--continue-from-report", "/tmp/dev.jsonl"]),
    /--continue-from-report requires --continue-from-report-sha256 and --continue-from-code-sha/,
  );
  assert.throws(
    () => parseArgs([...BASE_ARGV, "--continue-from-report-sha256", "a".repeat(64)]),
    /--continue-from-report requires --continue-from-report-sha256 and --continue-from-code-sha/,
  );
  const full = parseArgs([
    ...BASE_ARGV,
    "--continue-from-report",
    "/tmp/dev.jsonl",
    "--continue-from-report-sha256",
    "a".repeat(64),
    "--continue-from-code-sha",
    VALID_SHA,
  ]);
  assert.equal(full.continueFromReport, "/tmp/dev.jsonl");
  assert.equal(full.continueFromReportSha256, "a".repeat(64));
  assert.equal(full.continueFromCodeSha, VALID_SHA);
}

function testContinuationFlagsOnlyValidWithApply() {
  assert.throws(
    () =>
      parseArgs([
        "--environment",
        "DEV",
        "--manifest",
        "manifest.json",
        "--plan",
        "--continue-from-report",
        "/tmp/dev.jsonl",
        "--continue-from-report-sha256",
        "a".repeat(64),
        "--continue-from-code-sha",
        VALID_SHA,
      ]),
    /only valid with --apply/,
  );
}

function testContinuationFlagsCannotCombineWithResumeFrom() {
  assert.throws(
    () =>
      parseArgs([
        ...BASE_ARGV,
        "--continue-from-report",
        "/tmp/dev.jsonl",
        "--continue-from-report-sha256",
        "a".repeat(64),
        "--continue-from-code-sha",
        VALID_SHA,
        "--resume-from",
        "users",
      ]),
    /cannot be combined with --resume-from/,
  );
}

function testNoContinuationFlagsLeavesThemUndefined() {
  const args = parseArgs(BASE_ARGV);
  assert.equal(args.continueFromReport, undefined);
  assert.equal(args.continueFromReportSha256, undefined);
  assert.equal(args.continueFromCodeSha, undefined);
}

interface DockerfileStage {
  name: string;
  base: string;
  body: string;
}

function readDockerfile(): string {
  const dockerfilePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "Dockerfile");
  return readFileSync(dockerfilePath, "utf8");
}

function readRunbook(): string {
  const runbookPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "docs/migration/phoenix-release-runner.md",
  );
  return readFileSync(runbookPath, "utf8");
}

/**
 * A `docker run -d --rm` continuation container can exit and be auto-removed
 * before a separately-issued `docker wait` reaches it — exactly what
 * happened during the first real continuation attempt (see
 * docs/migration/prelaunch-checklist.md §J). The runbook must document the
 * safer `-d` (no `--rm`) + `docker wait` + inspect + `docker rm` sequence so
 * this doesn't need to be rediscovered operationally every time.
 */
function testRunbookDocumentsSaferExitCodeCaptureContract() {
  const runbook = readRunbook();
  assert.match(runbook, /docker wait/, "runbook must document `docker wait` for exit-code capture");
  assert.match(runbook, /--rm/, "runbook must discuss `--rm`'s interaction with exit-code capture");
  assert.match(
    runbook,
    /race|before.*captured|captured.*before/i,
    "runbook must explain the `--rm`/`docker wait` race, not just show a command",
  );
  const contract = runbook.slice(runbook.indexOf("docker run -d --name"), runbook.indexOf("```", runbook.indexOf("docker run -d --name")));
  const waitIndex = contract.indexOf("docker wait");
  const removeIndex = contract.indexOf("docker rm");
  assert.ok(waitIndex > 0, "the runnable contract must capture the exact exit code with docker wait");
  assert.equal(contract.slice(0, waitIndex).includes("--rm"), false, "the detached container must not auto-remove before docker wait");
  assert.ok(removeIndex > waitIndex, "the stopped container may only be removed after wait and evidence inspection");
}

function testRunbookDocumentsContinuationFlags() {
  const runbook = readRunbook();
  for (const flag of ["--continue-from-report", "--continue-from-report-sha256", "--continue-from-code-sha"]) {
    assert.ok(runbook.includes(flag), `runbook must document ${flag}`);
  }
  assert.match(runbook, /KNOWN_PREDECESSOR_CODE_SHAS/, "runbook must point at the predecessor-SHA allowlist, not just describe the flags");
}

/** Splits a Dockerfile into named stages by its `FROM <base> [AS <name>]` lines. */
function parseDockerfileStages(dockerfile: string): DockerfileStage[] {
  const lines = dockerfile.split("\n");
  const fromPattern = /^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/i;
  const stages: DockerfileStage[] = [];
  let current: { name: string; base: string; startIndex: number } | null = null;

  lines.forEach((line, index) => {
    const match = fromPattern.exec(line);
    if (!match) return;
    if (current) {
      stages.push({ name: current.name, base: current.base, body: lines.slice(current.startIndex + 1, index).join("\n") });
    }
    current = { name: match[2] ?? match[1], base: match[1], startIndex: index };
  });
  if (current) {
    stages.push({ name: current.name, base: current.base, body: lines.slice(current.startIndex + 1).join("\n") });
  }
  return stages;
}

function assertNoGit(stage: DockerfileStage) {
  assert.doesNotMatch(stage.body, /apk add[^\n]*\bgit\b/i, `${stage.name} must not install git`);
  assert.doesNotMatch(stage.body, /apt-get install[^\n]*\bgit\b/i, `${stage.name} must not install git`);
  assert.doesNotMatch(stage.body, /COPY[^\n]*\.git\b/, `${stage.name} must not copy .git`);
}

function testDockerfileStageGraphAndBakedShaContract() {
  const stages = parseDockerfileStages(readDockerfile());
  const byName = new Map(stages.map((stage) => [stage.name, stage]));

  const workspace = byName.get("workspace");
  assert.ok(workspace, "Dockerfile must declare a `workspace` stage");

  const builder = byName.get("builder");
  assert.ok(builder, "Dockerfile must declare a `builder` stage");
  assert.equal(builder!.base, "workspace", "`builder` must inherit from `workspace`");

  const phoenixMigrate = byName.get("phoenix-migrate");
  assert.ok(phoenixMigrate, "Dockerfile must declare a `phoenix-migrate` stage");
  assert.equal(phoenixMigrate!.base, "workspace", "`phoenix-migrate` must inherit from `workspace`");
  assert.notEqual(phoenixMigrate!.base, "builder", "`phoenix-migrate` must not inherit from `builder`");

  const runner = byName.get("runner");
  assert.ok(runner, "Dockerfile must declare a `runner` stage");
  assert.match(runner!.body, /COPY --from=builder/, "`runner` must keep copying from `builder`");

  for (const stage of stages) {
    if (stage.name === "builder") {
      assert.match(stage.body, /pnpm build:ci/, "`builder` must still run `pnpm build:ci`");
    } else {
      assert.doesNotMatch(stage.body, /pnpm build:ci/, `${stage.name} must not run pnpm build:ci`);
      assert.doesNotMatch(stage.body, /next build/, `${stage.name} must not run next build`);
    }
    assertNoGit(stage);
  }

  assert.doesNotMatch(
    phoenixMigrate!.body,
    /fonts\.googleapis\.com|fonts\.gstatic\.com/,
    "`phoenix-migrate` must not depend on Google Fonts",
  );

  assert.ok(phoenixMigrate!.body.includes("ARG PHOENIX_CODE_SHA"));
  assert.ok(phoenixMigrate!.body.includes("[0-9a-f]{40}"), "baked SHA must be validated as exact 40 lowercase hex chars");
  assert.ok(phoenixMigrate!.body.includes("/app/.phoenix-code-sha"));
  assert.ok(phoenixMigrate!.body.includes("chmod 0444"));
  assert.ok(
    phoenixMigrate!.body.includes("org.opencontainers.image.revision=$PHOENIX_CODE_SHA"),
    "OCI revision label must come from the validated build argument",
  );
}

function main() {
  testValidBakedShaIsReturned();
  testGitNotInvokedWhenBakedFileExists();
  testMissingBakedFileFallsBackToValidGitSha();
  testMalformedBakedShaFailsClosedWithoutGitFallback();
  testEmptyBakedShaFailsClosedWithoutGitFallback();
  testUnreadableBakedFileFailsClosedWithoutGitFallback();
  testMalformedGitOutputFails();
  testNeitherSourceAvailableProducesClearFailure();
  testDockerfileStageGraphAndBakedShaContract();
  testContinuationFlagsRequireAllThreeTogether();
  testContinuationFlagsOnlyValidWithApply();
  testContinuationFlagsCannotCombineWithResumeFrom();
  testNoContinuationFlagsLeavesThemUndefined();
  testRunbookDocumentsSaferExitCodeCaptureContract();
  testRunbookDocumentsContinuationFlags();
}

main();
console.log("migration-phoenix-release tests: OK");
