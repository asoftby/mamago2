import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { Prisma } from '@prisma/client';
import { isLocationCompatible } from '../../../src/features/birthday/builder/lib/catalogSelection';
import { CATEGORY_VARIANTS, DEMO_OFFERS, demoDates } from './catalog';
import { assertBirthdayDemoEnvironment } from './guard';

const safe = { APP_ENV: 'local', BIRTHDAY_DEMO_LOCAL: '1', DATABASE_URL: 'postgresql://test@127.0.0.1:55443/mamago_birthday_it?schema=public' };
assert.doesNotThrow(() => assertBirthdayDemoEnvironment(safe));
for (const changed of [
  { APP_ENV: 'production' }, { APP_ENV: 'devv' }, { NODE_ENV: 'production' }, { BIRTHDAY_DEMO_LOCAL: '' },
  { DATABASE_URL: 'postgresql://test@db.example:55443/mamago_birthday_it' },
  { DATABASE_URL: 'postgresql://test@127.0.0.1:5432/mamago_birthday_it' },
  { DATABASE_URL: 'postgresql://test@127.0.0.1:55443/mamago_dev' },
  { DATABASE_URL: safe.DATABASE_URL + '&host=real-db.example' },
  { DATABASE_URL: safe.DATABASE_URL + '&hostaddr=10.1.1.1' },
  { DATABASE_URL: safe.DATABASE_URL + '&schema=private' },
]) assert.throws(() => assertBirthdayDemoEnvironment({ ...safe, ...changed }), /REFUSED/);
assert.equal(DEMO_OFFERS.length, 37);
assert.equal(new Set(DEMO_OFFERS.map(o => o.key)).size, 37);
for (const category of Object.keys(CATEGORY_VARIANTS)) {
  const services = DEMO_OFFERS.filter(o => o.productType === 'PARTY_SERVICE' && o.category === category && !o.hidden && !o.otherCity);
  assert.equal(services.length, 3);
  assert.equal(new Set(services.map(o => o.business)).size, 3, category + ' replacements must cross businesses');
  assert.ok(services.filter(o => (o.ageMin ?? 0) <= 96 && isLocationCompatible({
    locationType: o.location, productType: o.productType, category: o.category,
  }, 'VENUE')).length >= 2, category + ' must have a compatible cross-business replacement for the default child');
}
assert.equal(DEMO_OFFERS.filter(o => o.productType === 'PARTY_PACKAGE').length, 5);
assert.deepEqual(new Set(DEMO_OFFERS.map(o => o.priceMode)), new Set(['EXACT', 'FROM', 'FREE', 'ON_REQUEST']));
assert.deepEqual(new Set(DEMO_OFFERS.flatMap(o => (o.components ?? []).flatMap(c => c.removalPolicy ? [c.removalPolicy] : []))),
  new Set(['REQUIRED', 'REMOVABLE_NO_REFUND', 'REMOVABLE_FIXED_CREDIT', 'REMOVABLE_QUOTE_REQUIRED']));
for (const offer of DEMO_OFFERS) {
  const credits = (offer.components ?? []).reduce((sum, c) => sum.add(c.removalCreditByn ?? 0), new Prisma.Decimal(0));
  if (credits.gt(0)) {
    assert.equal(offer.priceMode, 'EXACT');
    assert.ok(credits.lte(new Prisma.Decimal(offer.price!)));
  }
}
assert.equal(demoDates(new Date('2026-11-07T22:30:00Z')).partyDate, '2026-11-22');
assert.equal(demoDates(new Date('2026-12-25T12:00:00Z')).partyDate, '2027-01-08');

async function main() {
  // The CLI must refuse production before any DB connection, for BOTH destructive and seed actions.
  let connections = 0;
  const server = createServer(socket => { connections++; socket.destroy(); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  try {
    for (const action of ['seed', 'cleanup']) {
      const result = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/it/birthday-demo.ts', action], {
          env: { PATH: process.env.PATH, APP_ENV: 'production', BIRTHDAY_DEMO_LOCAL: '1',
            DATABASE_URL: `postgresql://test@127.0.0.1:${address.port}/mamago_birthday_it` },
        });
        let output = '';
        child.stdout.on('data', c => { output += c; }); child.stderr.on('data', c => { output += c; });
        child.on('error', reject); child.on('close', code => resolve({ code, output }));
      });
      assert.equal(result.code, 2); assert.match(result.output, /REFUSED: explicit isolated local environment/);
    }
    assert.equal(connections, 0);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  console.log('PASS demo inventory, prices, relative dates and pre-connection environment refusal');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
