'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const helper = path.resolve(__dirname, 'full-gate-proof.cjs');

function run(cwd, bin, args, env = {}) {
  return spawnSync(bin, args, {cwd, encoding:'utf8', env:{...process.env,...env}});
}
function git(cwd, ...args) {
  const r = run(cwd, 'git', args);
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}
function proof(cwd, action, env = {}) {return run(cwd, process.execPath, [helper, action], env);}

test('PASS is reusable only for identical clean SHA, base, installed lock and toolchain', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mamago-gate-proof-'));
  try {
    git(root,'init','-q','-b','dev');
    git(root,'config','user.name','Gate Test');
    git(root,'config','user.email','gate-test@example.invalid');
    fs.writeFileSync(path.join(root,'.gitignore'),'node_modules/\n.env*\n');
    fs.writeFileSync(path.join(root,'pnpm-lock.yaml'),'lockfileVersion: 9\n');
    fs.writeFileSync(path.join(root,'package.json'),'{}\n');
    git(root,'add','.'); git(root,'commit','-qm','base');
    git(root,'update-ref','refs/remotes/origin/dev',git(root,'rev-parse','HEAD'));
    git(root,'switch','-qc','chore/test');
    fs.writeFileSync(path.join(root,'change.txt'),'one\n');
    git(root,'add','change.txt'); git(root,'commit','-qm','task');
    fs.mkdirSync(path.join(root,'node_modules/.pnpm'),{recursive:true});
    fs.writeFileSync(path.join(root,'node_modules/.pnpm/lock.yaml'),'lockfileVersion: 9\n');

    assert.notEqual(proof(root,'check').status,0,'no proof must fail');
    assert.notEqual(proof(root,'record').status,0,'record without starting snapshot must fail');
    assert.equal(proof(root,'begin').status,0,'record starting fingerprint');
    assert.equal(proof(root,'record').status,0,'record with unchanged starting state');
    assert.equal(proof(root,'check').status,0,'unchanged candidate reuses proof');

    fs.writeFileSync(path.join(root,'change.txt'),'dirty\n');
    assert.notEqual(proof(root,'check').status,0,'dirty tracked tree must fail');
    git(root,'restore','change.txt');
    fs.writeFileSync(path.join(root,'untracked.txt'),'untracked\n');
    assert.notEqual(proof(root,'check').status,0,'untracked work must fail');
    fs.unlinkSync(path.join(root,'untracked.txt'));
    fs.writeFileSync(path.join(root,'node_modules/.pnpm/lock.yaml'),'changed install\n');
    assert.notEqual(proof(root,'check').status,0,'changed installed dependency snapshot must fail');
    assert.notEqual(proof(root,'record').status,0,'never certify a stale installed dependency graph');
    assert.notEqual(proof(root,'validate').status,0,'preflight blocks stale installed dependency graph');
    fs.writeFileSync(path.join(root,'node_modules/.pnpm/lock.yaml'),'lockfileVersion: 9\n');
    assert.notEqual(proof(root,'check',{...process.env,GATE_DATABASE_URL:'postgresql://example'}).status,0,'custom database must fail');
    assert.notEqual(proof(root,'check',{...process.env,NEXT_PUBLIC_TEST_GATE:'modified'}).status,0,'environment change must fail');
    assert.equal(proof(root,'validate').status,0,'preflight accepts restored matching lockfile');
    assert.equal(proof(root,'validate',{GATE_DATABASE_URL:'postgresql://test'}).status,0,'external test database allows full uncached gate');
    assert.equal(proof(root,'check').status,0,'restored inputs permit reuse');
    assert.notEqual(proof(root,'check',{REQUIRE_REDIRECT_MANIFEST:'1'}).status,0,'new safeguard variable invalidates proof');
    assert.notEqual(proof(root,'check',{REDIRECT_MANIFEST_MIN_ROWS:'900'}).status,0,'new manifest threshold invalidates proof');
    fs.writeFileSync(path.join(root,'.env.local'),'NEXT_SECRET=one\n');
    assert.notEqual(proof(root,'check').status,0,'ignored env file addition invalidates proof');
    fs.unlinkSync(path.join(root,'.env.local'));
    assert.equal(proof(root,'check').status,0,'restored env files permit reuse');
    assert.equal(proof(root,'begin').status,0,'capture start for env-file-change regression');
    fs.writeFileSync(path.join(root,'.env.production'),'NEXT_SECRET=changed\n');
    assert.notEqual(proof(root,'record').status,0,'env-file mutation during gate cannot be recorded');
    fs.unlinkSync(path.join(root,'.env.production'));

    fs.writeFileSync(path.join(root,'change.txt'),'two\n');
    git(root,'add','change.txt'); git(root,'commit','-qm','new SHA');
    assert.notEqual(proof(root,'check').status,0,'new SHA must fail');
    assert.notEqual(proof(root,'record').status,0,'record without begin must fail after new SHA');
    assert.equal(proof(root,'begin').status,0);
    assert.equal(proof(root,'record').status,0);
    assert.equal(proof(root,'check').status,0);
    git(root,'update-ref','refs/remotes/origin/dev',git(root,'rev-parse','HEAD'));
    assert.notEqual(proof(root,'check').status,0,'base advance must invalidate');
    assert.equal(proof(root,'clear').status,0);
    assert.equal(proof(root,'begin').status,0,'capture old commit before mid-run mutation');
    fs.writeFileSync(path.join(root,'change.txt'),'three\n');
    git(root,'add','change.txt'); git(root,'commit','-qm','mutated after gate began');
    assert.notEqual(proof(root,'record').status,0,'changed HEAD during gate must refuse PASS');
    assert.notEqual(proof(root,'check').status,0,'changed SHA has no accepted proof');
    assert.notEqual(proof(root,'check').status,0,'cleared proof must fail');
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});

test('pre-push executes a real uncached gate with GATE_DATABASE_URL and caches only normal successful gates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'mamago-gate-wrapper-'));
  const repo = path.join(root,'repo');
  const remote = path.join(root,'remote.git');
  const bin = path.join(root,'bin');
  const calls = path.join(root,'calls.log');
  fs.mkdirSync(repo); fs.mkdirSync(bin);
  try {
    git(root,'init','--bare','-q',remote);
    git(repo,'init','-q','-b','dev');
    git(repo,'config','user.name','Gate Test');
    git(repo,'config','user.email','gate-test@example.invalid');
    fs.mkdirSync(path.join(repo,'scripts/git'),{recursive:true});
    for (const name of ['full-gate-proof.cjs','run-push-gate.sh'])
      fs.copyFileSync(path.resolve(__dirname,name),path.join(repo,'scripts/git',name));
    fs.writeFileSync(path.join(repo,'scripts/git/worktree-deps.sh'),'#!/bin/sh\nexit 0\n');
    fs.writeFileSync(path.join(repo,'.gitignore'),'node_modules/\n');
    fs.writeFileSync(path.join(repo,'package.json'),'{}\n');
    fs.writeFileSync(path.join(repo,'pnpm-lock.yaml'),'lockfileVersion: 9\n');
    git(repo,'add','.'); git(repo,'commit','-qm','initial');
    git(repo,'remote','add','origin',remote);
    git(repo,'push','-u','origin','dev');
    git(repo,'switch','-qc','chore/test');
    fs.writeFileSync(path.join(repo,'feature.txt'),'task\n');
    git(repo,'add','feature.txt'); git(repo,'commit','-qm','task');
    fs.mkdirSync(path.join(repo,'node_modules/.pnpm'),{recursive:true});
    fs.writeFileSync(path.join(repo,'node_modules/.pnpm/lock.yaml'),'lockfileVersion: 9\n');
    const stub = path.join(bin,'pnpm');
    fs.writeFileSync(stub,'#!/bin/sh\nif [ "$1" = "--version" ]; then echo 10.28.2; else echo "$*" >> "$PNPM_STUB_LOG"; fi\n');
    fs.chmodSync(stub,0o755);
    const env = {PATH:bin+path.delimiter+process.env.PATH, PNPM_STUB_LOG:calls};
    const invoke = (extra={}) => run(repo,'sh',['scripts/git/run-push-gate.sh'],{...env,...extra});
    const first = invoke({GATE_DATABASE_URL:'postgresql://test-db'});
    assert.equal(first.status,0,`custom DB must run gate, not block: ${first.stderr}`);
    assert.equal(fs.readFileSync(calls,'utf8').trim(),'check:push');
    assert.notEqual(proof(repo,'check',env).status,0,'custom DB execution must not record reusable proof');
    // Reproduce the real Git pre-push hook process: Git + Husky prepend two
    // tool paths and Git supplies GIT_PREFIX / GIT_EXEC_PATH metadata.
    const gitExec = git(repo,'--exec-path');
    const hookEnv = {PATH:`node_modules/.bin${path.delimiter}${gitExec}${path.delimiter}${env.PATH}`, GIT_EXEC_PATH:gitExec, GIT_PREFIX:''};
    const second = invoke(hookEnv);
    assert.equal(second.status,0,`hook gate failed: ${second.stderr}`);
    assert.equal(fs.readFileSync(calls,'utf8').trim().split('\n').length,2);
    const third = invoke();
    assert.equal(third.status,0,`cache reuse failed: ${third.stderr}`);
    assert.match(third.stdout,/PASS reuse/);
    assert.equal(fs.readFileSync(calls,'utf8').trim().split('\n').length,2,'cache reuse must not rerun pnpm check:push');
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
