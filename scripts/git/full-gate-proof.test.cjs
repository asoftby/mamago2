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
    fs.writeFileSync(path.join(root,'.gitignore'),'node_modules/\n');
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
    assert.equal(proof(root,'record').status,0,'record in valid state');
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
    assert.equal(proof(root,'check').status,0,'restored inputs permit reuse');

    fs.writeFileSync(path.join(root,'change.txt'),'two\n');
    git(root,'add','change.txt'); git(root,'commit','-qm','new SHA');
    assert.notEqual(proof(root,'check').status,0,'new SHA must fail');
    assert.equal(proof(root,'record').status,0);
    assert.equal(proof(root,'check').status,0);
    git(root,'update-ref','refs/remotes/origin/dev',git(root,'rev-parse','HEAD'));
    assert.notEqual(proof(root,'check').status,0,'base advance must invalidate');
    assert.equal(proof(root,'clear').status,0);
    assert.notEqual(proof(root,'check').status,0,'cleared proof must fail');
  } finally {fs.rmSync(root,{recursive:true,force:true});}
});
