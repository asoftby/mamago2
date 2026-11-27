/** Local acceptance server: no inherited email/SMS/Telegram/cloud credentials. */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { assertBirthdayDemoEnvironment } from './birthdayDemo/guard';

try {
  assertBirthdayDemoEnvironment(process.env);
  if (['.env', '.env.local', '.env.development', '.env.development.local'].some(existsSync)) {
    throw new Error('BIRTHDAY_DEMO REFUSED: Next.js env files could load external credentials; use the isolated task checkout without env files');
  }
  const child = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'dev', '--webpack', '-H', '127.0.0.1', '-p', '34357'], {
    stdio: 'inherit',
    env: {
      PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
      APP_ENV: 'local', NODE_ENV: 'development', DATABASE_URL: process.env.DATABASE_URL,
      NODE_OPTIONS: '--max-old-space-size=6144', NEXT_DIST_DIR: 'node_modules/.cache/next-birthday-demo',
      APP_PUBLIC_URL: 'http://127.0.0.1:34357', NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:34357',
      NEXT_DEV_ALLOWED_ORIGINS: '127.0.0.1:34357,localhost:34357',
      PARTY_CONFIRMATION_ENABLED: 'true', BUSINESS_BOOKINGS_INBOX_UI: 'true', NEXT_PUBLIC_BUSINESS_BOOKINGS_INBOX_UI: 'true', FAMILY_CORE_READS: '1',
    },
  });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => child.kill(signal));
} catch (error) {
  console.error(error instanceof Error ? error.message : error); process.exitCode = 2;
}
