#!/usr/bin/env node
'use strict';
// Worktree-local evidence of a successful full pnpm check:push run. Never commit this proof.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

function shell(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}
function hash(content) { return crypto.createHash('sha256').update(content).digest('hex'); }
function proofFile() { return path.resolve(shell('git', ['rev-parse', '--git-path', 'mamago-full-gate-proof.json'])); }
function fingerprint() {
  const branch = shell('git', ['branch', '--show-current']);
  if (!branch || branch === 'dev' || branch === 'main') throw new Error('not a task branch');
  if (shell('git', ['status', '--porcelain', '--untracked-files=all'])) throw new Error('worktree is not clean');
  const head = shell('git', ['rev-parse', 'HEAD']);
  const base = shell('git', ['rev-parse', 'origin/dev']);
  if (spawnSync('git', ['merge-base', '--is-ancestor', base, head]).status !== 0) throw new Error('not based on current origin/dev');
  if (process.versions.node.split('.')[0] !== '22') throw new Error('Node 22 required');
  if (process.env.GATE_DATABASE_URL) throw new Error('custom gate database cannot be reused');
  const localLock = fs.readFileSync('pnpm-lock.yaml');
  const installedLock = fs.readFileSync('node_modules/.pnpm/lock.yaml');
  if (!localLock.equals(installedLock)) throw new Error('installed dependencies do not match pnpm-lock.yaml; run pnpm install --frozen-lockfile');
  // Never save environment values or secrets, only a digest of gate-affecting settings.
  const prefixes = /^(NEXT_|GATE_|SENTRY_|PRISMA_|PNPM_|EMAIL_)/;
  const env = Object.entries(process.env)
    .filter(([key]) => prefixes.test(key) || ['CI','NODE_OPTIONS','NODE_ENV','APP_ENV','DATABASE_URL'].includes(key))
    .sort(([a], [b]) => a.localeCompare(b));
  return {
    version: 1, head, base, tree: shell('git', ['rev-parse', 'HEAD^{tree}']),
    repository: fs.realpathSync(process.cwd()),
    node: process.version, nodePath: fs.realpathSync(process.execPath),
    pnpm: shell('pnpm', ['--version']), platform: process.platform, arch: process.arch,
    lockHash: hash(localLock), installedLockHash: hash(installedLock),
    envHash: hash(JSON.stringify(env)), gateCommand: 'pnpm check:push',
  };
}
function main() {
  const action = process.argv[2];
  if (!['check', 'record', 'clear', 'validate'].includes(action)) throw new Error('expected check|record|clear|validate');
  const dest = proofFile();
  if (action === 'clear') { try { fs.unlinkSync(dest); } catch (e) { if (e.code !== 'ENOENT') throw e; } return; }
  const key = fingerprint();
  if (action === 'validate') return;
  if (action === 'check') {
    let existing;
    try { existing = JSON.parse(fs.readFileSync(dest, 'utf8')); } catch (_) { process.exitCode = 1; return; }
    if (JSON.stringify(existing.key) !== JSON.stringify(key) || existing.result !== 'PASS') {
      process.exitCode = 1;
      return;
    }
    console.log(`[full-gate-proof] PASS reuse: HEAD ${key.head.slice(0,12)}, unchanged tree/base/dependencies/toolchain`);
    return;
  }
  const tmp = dest + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({result:'PASS', key, createdAt:new Date().toISOString()})+'\n', {mode:0o600, flag:'wx'});
  fs.renameSync(tmp, dest);
  console.log(`[full-gate-proof] Recorded PASS for HEAD ${key.head.slice(0,12)}`);
}
try { main(); } catch (e) { console.error('[full-gate-proof] ' + e.message); process.exitCode = 1; }
