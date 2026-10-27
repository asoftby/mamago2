#!/usr/bin/env node
// Runs the push-gate steps one by one and reports EVERY failure, instead of stopping at the
// first red step like a `&&` chain does. Prints a step → seconds → result table at the end.
//
//   node scripts/git/run-gate-steps.mjs [--tsc] [--tests | --changed-tests] [--build]
//
//   --tsc             `tsc --noEmit` (incremental via tsconfig.json)
//   --tests           every suite listed in scripts/git/gate-steps.json (required CI job `gate-tests`)
//   --changed-tests   only the suites whose area the branch touches (local pre-push hook);
//                     falls back to all suites when the diff touches shared config, the gate itself,
//                     or when the base cannot be resolved
//   --build           `pnpm build`
//   --list            print the selected steps and exit without running them
//
//   GATE_BASE_REF=<ref>     diff base for --changed-tests (default origin/dev)
//   GATE_CHANGED_FILES=...  whitespace-separated paths used instead of the git diff (dry runs with --list)
//   GATE_REPORT=<file>      also write the result table as Markdown to this file
//
// Exit code is non-zero when any step failed.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
process.chdir(root);

const args = new Set(process.argv.slice(2));
const known = ["--tsc", "--tests", "--changed-tests", "--build", "--list"];
for (const a of args) {
  if (!known.includes(a)) {
    console.error(`[gate] unknown option ${a}; allowed: ${known.join(" ")}`);
    process.exit(2);
  }
}
if ([...args].every((a) => a === "--list") || (args.has("--tests") && args.has("--changed-tests"))) {
  console.error("[gate] usage: run-gate-steps.mjs [--tsc] [--tests | --changed-tests] [--build]");
  process.exit(2);
}

const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
const suites = JSON.parse(readFileSync("scripts/git/gate-steps.json", "utf8")).tests;
for (const name of suites) {
  if (!scripts[name]) {
    console.error(`[gate] scripts/git/gate-steps.json lists ${name}, which is not a package.json script`);
    process.exit(2);
  }
}

// A change to any of these can break any suite, so the local gate then runs all of them.
const GLOBAL_TRIGGERS = [
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^tsconfig[^/]*\.json$/,
  /^prisma\//,
  /^scripts\/git\//,
  /^\.husky\//,
];

// Test files a suite runs, following nested `pnpm test:*` calls.
function suiteFiles(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const files = [];
  for (const part of scripts[name].split("&&")) {
    const nested = part.match(/pnpm (?:run )?(test:[\w:-]+)/);
    if (nested && scripts[nested[1]]) {
      files.push(...suiteFiles(nested[1], seen));
      continue;
    }
    for (const m of part.matchAll(/"([^"]+\.[cm]?[jt]sx?|[^"]+\.(?:sh|py))"|((?:src|scripts|lib)\/\S+\.(?:[cm]?[jt]sx?|sh|py))/g)) {
      files.push(m[1] ?? m[2]);
    }
  }
  return files;
}

function changedFiles() {
  const base = process.env.GATE_BASE_REF || "origin/dev";
  if (process.env.GATE_CHANGED_FILES) {
    return { base: "GATE_CHANGED_FILES", files: process.env.GATE_CHANGED_FILES.split(/\s+/).filter(Boolean) };
  }
  try {
    const mergeBase = execFileSync("git", ["merge-base", "HEAD", base], { encoding: "utf8" }).trim();
    const out = execFileSync("git", ["diff", "--name-only", `${mergeBase}..HEAD`], { encoding: "utf8" });
    return { base, files: out.split("\n").filter(Boolean) };
  } catch {
    return { base, files: null };
  }
}

function selectChangedSuites() {
  const { base, files } = changedFiles();
  if (files === null) {
    console.log(`[gate] cannot diff against ${base}; running all ${suites.length} suites`);
    return suites;
  }
  const global = files.find((f) => GLOBAL_TRIGGERS.some((re) => re.test(f)));
  if (global) {
    console.log(`[gate] ${global} changed; running all ${suites.length} suites`);
    return suites;
  }
  // A suite covers the directories of its test files: a change anywhere in them selects it.
  const picked = suites.filter((name) => {
    const dirs = [...new Set(suiteFiles(name).map((f) => path.posix.dirname(f) + "/"))];
    return files.some((f) => dirs.some((d) => f.startsWith(d)));
  });
  console.log(
    `[gate] ${files.length} file(s) changed vs ${base}; running ${picked.length}/${suites.length} suites ` +
      "(all suites run in the required CI job gate-tests)",
  );
  return picked;
}

const steps = [];
if (args.has("--tsc")) steps.push({ name: "tsc --noEmit", cmd: "pnpm exec tsc --noEmit" });
const selected = args.has("--tests") ? suites : args.has("--changed-tests") ? selectChangedSuites() : [];
for (const name of selected) steps.push({ name, cmd: `pnpm ${name}` });
if (args.has("--build")) steps.push({ name: "pnpm build", cmd: "pnpm build" });

if (args.has("--list")) {
  for (const step of steps) console.log(step.name);
  process.exit(0);
}

const results = [];
const started = Date.now();
for (const step of steps) {
  console.log(`\n[gate] ▶ ${step.name}`);
  const t0 = Date.now();
  const r = spawnSync(step.cmd, { shell: true, stdio: "inherit" });
  const seconds = (Date.now() - t0) / 1000;
  const ok = r.status === 0;
  results.push({ ...step, seconds, ok, code: r.status ?? r.signal });
  console.log(`[gate] ${ok ? "✔" : "✘"} ${step.name} (${seconds.toFixed(1)}s)`);
}

const total = (Date.now() - started) / 1000;
const failed = results.filter((r) => !r.ok);
const rows = results.map((r) => `| ${r.name} | ${r.seconds.toFixed(1)} | ${r.ok ? "ok" : `FAIL (${r.code})`} |`);
const table = ["| step | seconds | result |", "|---|---:|---|", ...rows, `| **total** | **${total.toFixed(1)}** | ${failed.length ? `**${failed.length} failed**` : "ok"} |`].join("\n");

console.log(`\n[gate] summary\n${table}`);
if (process.env.GATE_REPORT) writeFileSync(process.env.GATE_REPORT, table + "\n");
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## Gate steps\n\n${table}\n`, { flag: "a" });

if (failed.length) {
  console.error(`\n[gate] FAIL: ${failed.length} of ${results.length} step(s) failed: ${failed.map((r) => r.name).join(", ")}`);
  process.exit(1);
}
console.log(`\n[gate] PASS: ${results.length} step(s) in ${total.toFixed(1)}s`);
