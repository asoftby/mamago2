/** Deliberately narrower than APP_ENV=dev: a shared DEV URL must never be accepted. */
export function assertBirthdayDemoEnvironment(env: NodeJS.ProcessEnv) {
  if (!['dev', 'local', 'test'].includes(env.APP_ENV ?? '') || env.NODE_ENV === 'production' || env.BIRTHDAY_DEMO_LOCAL !== '1') {
    throw new Error('BIRTHDAY_DEMO REFUSED: explicit isolated local environment required');
  }
  let url: URL;
  try { url = new URL(env.DATABASE_URL ?? ''); } catch { throw new Error('BIRTHDAY_DEMO REFUSED: invalid database URL'); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
      url.port !== '55443' || url.pathname !== '/mamago_birthday_it' || [...url.searchParams].some(([key, value]) => key !== 'schema' || value !== 'public')) {
    throw new Error('BIRTHDAY_DEMO REFUSED: only 127.0.0.1:55443/mamago_birthday_it is trusted');
  }
}
