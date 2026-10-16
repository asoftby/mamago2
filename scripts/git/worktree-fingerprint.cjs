#!/usr/bin/env node
// Local generated state only: no database connection and no environment values.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

function digest(files) {
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file).update('\0').update(fs.readFileSync(file)).update('\0');
  }
  return hash.digest('hex');
}

try {
  const mode = process.argv[2];
  if (!['write', 'check', 'ownership'].includes(mode)) throw new Error('Expected write, check or ownership');
  const root = fs.realpathSync(process.cwd());
  const modules = fs.realpathSync(path.join(root, 'node_modules'));
  if (!modules.startsWith(root + path.sep)) throw new Error('node_modules is outside this worktree');
  const entry = require.resolve('@prisma/client', { paths: [root] });
  if (!fs.realpathSync(entry).startsWith(modules + path.sep)) {
    throw new Error('Prisma package is outside this worktree');
  }
  // Check package ownership before the generator can write into its output.
  if (mode === 'ownership') process.exit(0);
  const client = fs.realpathSync(require.resolve('.prisma/client/index.js', { paths: [entry] }));
  if (!client.startsWith(modules + path.sep)) {
    throw new Error('Generated Prisma Client is outside this worktree');
  }
  const schemas = fs.readdirSync('prisma').filter(f => f.endsWith('.prisma')).sort()
    .map(f => path.join('prisma', f));
  if (!schemas.length) throw new Error('No Prisma schema files');
  const config = ['prisma.config.ts'].filter(f => fs.existsSync(f));
  const state = JSON.stringify({
    version: 1,
    schema: digest([...schemas, ...config]),
    clientPath: path.relative(root, client),
    client: digest([client, path.join(path.dirname(client), 'index.d.ts')]),
  });
  const directory = path.join(root, 'node_modules', '.cache');
  const stamp = path.join(directory, 'mamago-worktree-deps.json');
  if (mode === 'check') {
    if (fs.readFileSync(stamp, 'utf8') !== state) process.exitCode = 1;
  } else {
    fs.mkdirSync(directory, { recursive: true });
    if (!fs.realpathSync(directory).startsWith(modules + path.sep)) {
      throw new Error('Dependency fingerprint directory is outside this worktree');
    }
    const temporary = `${stamp}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, state, { mode: 0o600 });
    fs.renameSync(temporary, stamp);
  }
} catch (error) {
  if (process.argv[2] !== 'check') console.error('[worktree-deps] Cannot fingerprint generated client:', error.message);
  process.exitCode = 1;
}
