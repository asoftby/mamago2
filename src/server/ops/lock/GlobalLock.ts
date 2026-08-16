/**
 * Session-level PostgreSQL advisory lock manager (§21 Step 2, Phase D).
 *
 * Deliberately NOT Prisma: session-level advisory locks must be acquired
 * and released on the exact same PostgreSQL connection/session, which
 * Prisma's pooled/multiplexed client cannot guarantee. This wraps a
 * dedicated `pg.Client` that owns exactly one connection for its lifetime.
 *
 * Uses `hashtextextended(name, 0)` (64-bit) rather than `hashtext(name)`
 * (32-bit) — the frozen contract requires the wider hash to avoid
 * collisions between unrelated lock names.
 *
 * If the underlying connection dies, PostgreSQL releases all of that
 * session's advisory locks automatically — no custom distributed locking
 * table is needed or implemented here.
 */
import { Client } from "pg";

export class GlobalLock {
  private readonly client: Client;
  private connected = false;

  constructor(connectionString: string) {
    this.client = new Client({ connectionString });
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.client.connect();
    this.connected = true;
  }

  /** Non-blocking. Returns true iff this session now holds the lock. */
  async tryAcquire(name: string): Promise<boolean> {
    const res = await this.client.query<{ pg_try_advisory_lock: boolean }>(
      "SELECT pg_try_advisory_lock(hashtextextended($1, 0))",
      [name],
    );
    return res.rows[0]?.pg_try_advisory_lock === true;
  }

  /** Releases a lock held by this session. No-op (false) if not held. */
  async release(name: string): Promise<boolean> {
    const res = await this.client.query<{ pg_advisory_unlock: boolean }>(
      "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
      [name],
    );
    return res.rows[0]?.pg_advisory_unlock === true;
  }

  /** Obtain the current DB time on this session — used for DB-time reads elsewhere. */
  async dbNow(): Promise<Date> {
    const res = await this.client.query<{ now: Date }>("SELECT clock_timestamp() AS now");
    return res.rows[0].now;
  }

  /** Closes the underlying connection; PostgreSQL releases any held locks. */
  async close(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;
    await this.client.end();
  }
}

export const DETECTOR_LOCK_PREFIX = "detector:";
export const SNAPSHOT_BUILDER_LOCK_NAME = "operations.snapshot_builder";

export function detectorLockName(detectorName: string): string {
  return `${DETECTOR_LOCK_PREFIX}${detectorName}`;
}
