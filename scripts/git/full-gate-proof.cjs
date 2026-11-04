#!/usr/bin/env node
'use strict';
// Worktree-local evidence of a completed full check:push. This is not a CI substitute.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

function git(...args) { return execFileSync('git', args, {encoding:'utf8', stdio:['ignore','pipe','ignore']}).trim(); }
function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function location(name) { return path.resolve(git('rev-parse', '--git-path', `mamago-full-gate-${name}.json`)); }
function remove(file) { try { fs.unlinkSync(file); } catch(e) { if(e.code !== 'ENOENT') throw e; } }
function write(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data)+'\n', {mode:0o600, flag:'wx'});
  try { fs.renameSync(tmp, file); } finally { remove(tmp); }
}
function lockfile() {
  const committed = fs.readFileSync('pnpm-lock.yaml');
  const installed = fs.readFileSync('node_modules/.pnpm/lock.yaml');
  if (!committed.equals(installed)) throw new Error('installed dependencies differ from pnpm-lock.yaml; run pnpm install --frozen-lockfile');
  return sha(committed);
}
function environmentDigest() {
  // All effective variables, not merely known prefixes: build settings can be added
  // in next.config.ts without updating this script. Ignore shell-process metadata only.
  const volatile = new Set(['PWD','OLDPWD','SHLVL','_','GIT_PREFIX','GIT_EXEC_PATH']);
  const gitExecPath = git('--exec-path');
  // Git injects its exec-path into hooks; Husky prepends node_modules/.bin.
  // Strip ONLY these known leading hook wrappers, not arbitrary PATH changes.
  function normalizedPath(value) {
    const paths = value.split(path.delimiter);
    while (paths[0] === gitExecPath || paths[0] === 'node_modules/.bin') paths.shift();
    return paths.join(path.delimiter);
  }
  const env = Object.entries(process.env)
    .filter(([name]) => !volatile.has(name))
    .map(([name,value]) => [name,name === 'PATH' ? normalizedPath(value) : value])
    .sort(([a],[b]) => a.localeCompare(b));
  // Ignored .env* files do not appear in git status; include all root Next.js env files.
  const envFiles = fs.readdirSync('.').filter(name => /^\.env(?:\.|$)/.test(name))
    .sort().map(name => [name, sha(fs.readFileSync(name))]);
  return sha(JSON.stringify({env, envFiles})); // never persist secret values
}
function fingerprint() {
  const branch = git('branch','--show-current');
  if (!branch || branch === 'dev' || branch === 'main') throw new Error('not a task branch');
  if (git('status','--porcelain','--untracked-files=all')) throw new Error('worktree not clean');
  const head = git('rev-parse','HEAD');
  const base = git('rev-parse','origin/dev');
  if (spawnSync('git',['merge-base','--is-ancestor',base,head]).status !== 0) throw new Error('stale origin/dev base');
  if (process.versions.node.split('.')[0] !== '22') throw new Error('Node 22 required');
  if (process.env.GATE_DATABASE_URL) throw new Error('custom gate database must run uncached');
  const lockHash = lockfile();
  return {
    version:2, head, base, tree:git('rev-parse','HEAD^{tree}'),
    repository:fs.realpathSync(process.cwd()), node:process.version,
    nodePath:fs.realpathSync(process.execPath),
    pnpm:execFileSync('pnpm',['--version'],{encoding:'utf8'}).trim(),
    pnpmPath:execFileSync('which',['pnpm'],{encoding:'utf8'}).trim(), gitExecPath:git('--exec-path'),
    platform:process.platform, arch:process.arch, lockHash,
    envHash:environmentDigest(), gateCommand:'pnpm check:push'
  };
}
function main() {
  const action = process.argv[2];
  if (!['check','begin','record','clear','abort','validate'].includes(action)) throw new Error('expected check|begin|record|clear|abort|validate');
  const dest = location('proof');
  const pending = location('inflight');
  if (action === 'abort') { remove(pending); return; }
  if (action === 'clear') { remove(dest); remove(pending); return; }
  if (action === 'validate') { lockfile(); return; }
  const current = fingerprint();
  if (action === 'check') {
    let proof;
    try { proof = JSON.parse(fs.readFileSync(dest,'utf8')); } catch(_) { process.exitCode=1; return; }
    if (proof.result !== 'PASS' || JSON.stringify(proof.key) !== JSON.stringify(current)) {
      process.exitCode=1; return;
    }
    console.log(`[full-gate-proof] PASS reuse: HEAD ${current.head.slice(0,12)}; inputs unchanged`);
    return;
  }
  if (action === 'begin') {
    write(pending, {key:current, startedAt:new Date().toISOString()});
    console.log(`[full-gate-proof] Started full gate for HEAD ${current.head.slice(0,12)}`);
    return;
  }
  let started;
  try { started=JSON.parse(fs.readFileSync(pending,'utf8')); }
  catch(_) { throw new Error('missing initial gate fingerprint; refusing PASS record'); }
  if (JSON.stringify(started.key) !== JSON.stringify(current)) {
    remove(pending);
    throw new Error('HEAD, base, dependencies, or environment changed during gate; refusing PASS');
  }
  write(dest,{result:'PASS',key:current,createdAt:new Date().toISOString()});
  remove(pending);
  console.log(`[full-gate-proof] Recorded PASS for HEAD ${current.head.slice(0,12)}`);
}
try { main(); } catch(e) { console.error('[full-gate-proof] '+e.message); process.exitCode=1; }
