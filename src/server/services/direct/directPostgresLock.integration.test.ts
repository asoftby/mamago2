/** PostgreSQL row-lock concurrency regression. Uses an isolated temporary table,
 * not production Direct data; the Direct service wiring is checked separately. */
import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";

const connectionString = process.env.DIRECT_LOCK_TEST_DATABASE_URL;

test("PostgreSQL serializes send after moderator block", { skip: !connectionString }, async () => {
  const { Client } = pg;
  const owner = new Client({ connectionString });
  const sender = new Client({ connectionString });
  const moderator = new Client({ connectionString });
  await Promise.all([owner.connect(), sender.connect(), moderator.connect()]);
  const table = "direct_lock_test_" + process.pid;
  try {
    await owner.query(`CREATE TABLE "${table}" (id integer PRIMARY KEY, status text NOT NULL)`);
    await owner.query(`INSERT INTO "${table}" VALUES (1, 'OPEN')`);
    await moderator.query("BEGIN");
    await moderator.query(`UPDATE "${table}" SET status='BLOCKED' WHERE id=1`);
    await sender.query("BEGIN");
    // Set a short lock timeout: the send must wait, not observe stale OPEN.
    await sender.query("SET LOCAL lock_timeout = '150ms'");
    await assert.rejects(
      sender.query(`SELECT id FROM "${table}" WHERE id=1 FOR UPDATE`),
      (error: unknown) => (error as { code?: string }).code === "55P03",
    );
    await sender.query("ROLLBACK");
    await moderator.query("COMMIT");
    await sender.query("BEGIN");
    await sender.query(`SELECT id FROM "${table}" WHERE id=1 FOR UPDATE`);
    const result = await sender.query(`SELECT status FROM "${table}" WHERE id=1`);
    assert.equal(result.rows[0]?.status, "BLOCKED");
    await sender.query("ROLLBACK");
  } finally {
    await Promise.allSettled([sender.query("ROLLBACK"), moderator.query("ROLLBACK")]);
    await owner.query(`DROP TABLE IF EXISTS "${table}"`);
    await Promise.all([owner.end(), sender.end(), moderator.end()]);
  }
});
