/**
 * Identity retention (постановление Совмина РБ № 850) against a disposable local
 * Postgres: account deletion seals identification data into IdentityRetentionRecord
 * atomically, fails closed without a usable key, and the cron purge removes only
 * records whose one-year term has passed.
 *
 *   NODE_OPTIONS=--conditions=react-server tsx <this file>
 */
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { deleteAccount } from "@/server/account/deleteAccount.service";
import { IDENTITY_RETENTION_PUBLIC_KEY_ENV, loadPublicKey, openIdentityEnvelope } from "./envelope";
import { purgeExpiredIdentityRecords } from "./purge";
import { installTestIdentityRetentionKey } from "./testKey";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must point at a disposable test database");
if (!["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("identity retention integration tests refuse non-local databases");
}

const env = process.env as Record<string, string | undefined>;
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const run = randomUUID().slice(0, 8);
const userIds: string[] = [];
const recordIds: string[] = [];
const key = installTestIdentityRetentionKey();

/** process.env coerces undefined to the string "undefined", so restore by deleting. */
function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete env[name];
  else env[name] = value;
}

after(async () => {
  await db.identityRetentionRecord.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { id: { in: recordIds } }] },
  });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

let phoneSeq = 0;
async function mkUser(label: string) {
  const id = `idr-${run}-${label}`;
  phoneSeq += 1;
  const user = await db.user.create({
    data: {
      id,
      email: `${id}@example.test`,
      phoneE164: `+37529${String(Date.now() % 10_000_000).padStart(7, "0").slice(0, 6)}${phoneSeq}`,
      phoneVerifiedAt: new Date("2026-01-05T00:00:00Z"),
      displayName: `Parent ${label}`,
      telegramId: `tg-${id}`,
      telegramUsername: `tg_${label}`,
    },
  });
  userIds.push(id);
  return user;
}

test("deletion seals identification data before wiping it; only the private key opens it", async () => {
  const user = await mkUser("sealed");
  const businessPhoneE164 = user.phoneE164!.replace("+37529", "+37533");
  const businessPhoneVerifiedAt = new Date("2026-01-07T00:00:00.000Z");
  await db.user.update({
    where: { id: user.id },
    data: {
      businessContactVerifiedPhoneE164: businessPhoneE164,
      businessContactPhoneVerifiedAt: businessPhoneVerifiedAt,
    },
  });
  assert.deepEqual(await deleteAccount(user.id, db), { ok: true });

  const tombstone = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(tombstone.phoneE164, null);
  assert.equal(tombstone.businessContactVerifiedPhoneE164, null,
    "verified business phone must not survive in plaintext tombstone");
  assert.equal(tombstone.businessContactPhoneVerifiedAt, null,
    "verified business phone timestamp must be erased on account deletion");
  assert.equal(tombstone.telegramId, null);
  assert.notEqual(tombstone.email, user.email);
  assert.ok(tombstone.deletedAt);

  const record = await db.identityRetentionRecord.findUniqueOrThrow({ where: { userId: user.id } });
  assert.equal(record.keyId, key.privateKey.keyId);
  assert.equal(record.agreementEndedAt.getTime(), tombstone.deletedAt!.getTime());
  assert.equal(record.accountCreatedAt.getTime(), user.createdAt.getTime());
  const expectedPurge = new Date(tombstone.deletedAt!.getTime());
  expectedPurge.setUTCFullYear(expectedPurge.getUTCFullYear() + 1);
  assert.equal(record.purgeAfter.getTime(), expectedPurge.getTime());
  assert.ok(!record.envelope.includes(user.phoneE164!.slice(1)), "phone never stored in plaintext");
  assert.ok(!record.envelope.includes(businessPhoneE164.slice(1)),
    "business phone never stored in plaintext archive");
  assert.ok(!record.envelope.includes(user.email), "email never stored in plaintext");

  const identity = openIdentityEnvelope(record.envelope, user.id, key.privateKey);
  assert.equal(identity.userId, user.id);
  assert.equal(identity.email, user.email);
  assert.equal(identity.phoneE164, user.phoneE164);
  assert.equal(identity.phoneVerifiedAt, "2026-01-05T00:00:00.000Z");
  assert.equal(identity.businessContactPhoneE164, businessPhoneE164);
  assert.equal(identity.businessContactPhoneVerifiedAt, businessPhoneVerifiedAt.toISOString());
  assert.equal(identity.displayName, user.displayName);
  assert.equal(identity.telegramId, user.telegramId);
  assert.equal(identity.telegramUsername, user.telegramUsername);
});

test("missing or weak key refuses deletion up front and writes nothing", async () => {
  const user = await mkUser("nokey");
  const saved = env[IDENTITY_RETENTION_PUBLIC_KEY_ENV];
  try {
    delete env[IDENTITY_RETENTION_PUBLIC_KEY_ENV];
    assert.deepEqual(await deleteAccount(user.id, db), { ok: false, code: "IDENTITY_RETENTION_UNAVAILABLE" });

    env[IDENTITY_RETENTION_PUBLIC_KEY_ENV] = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    }).publicKey;
    assert.deepEqual(await deleteAccount(user.id, db), { ok: false, code: "IDENTITY_RETENTION_UNAVAILABLE" });
  } finally {
    restoreEnv(IDENTITY_RETENTION_PUBLIC_KEY_ENV, saved);
  }

  const untouched = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(untouched.deletedAt, null);
  assert.equal(untouched.phoneE164, user.phoneE164);
  assert.equal(untouched.email, user.email);
  assert.equal(await db.identityRetentionRecord.count({ where: { userId: user.id } }), 0);
});

test("a failing archive write rolls back the whole deletion (user keeps phone and email)", async () => {
  const user = await mkUser("rollback");
  const blocker = await db.identityRetentionRecord.create({
    data: {
      userId: user.id,
      keyId: "blocker",
      envelope: "{}",
      accountCreatedAt: new Date(),
      agreementEndedAt: new Date(),
      purgeAfter: new Date(Date.now() + 86_400_000),
    },
  });
  recordIds.push(blocker.id);

  await assert.rejects(deleteAccount(user.id, db));
  const still = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(still.deletedAt, null);
  assert.equal(still.phoneE164, user.phoneE164);
  assert.equal(still.email, user.email);
});

test("explicit key option takes precedence over the environment", async () => {
  const user = await mkUser("option");
  const saved = env[IDENTITY_RETENTION_PUBLIC_KEY_ENV];
  try {
    delete env[IDENTITY_RETENTION_PUBLIC_KEY_ENV];
    const result = await deleteAccount(user.id, db, { identityRetentionPublicKey: loadPublicKey(key.publicKeyPem) });
    assert.deepEqual(result, { ok: true });
  } finally {
    restoreEnv(IDENTITY_RETENTION_PUBLIC_KEY_ENV, saved);
  }
  assert.equal(await db.identityRetentionRecord.count({ where: { userId: user.id } }), 1);
});

async function mkRecord(label: string, purgeAfter: Date) {
  const record = await db.identityRetentionRecord.create({
    data: {
      userId: `idr-${run}-rec-${label}`,
      keyId: "test",
      envelope: "{}",
      accountCreatedAt: new Date("2025-01-01T00:00:00Z"),
      agreementEndedAt: new Date(purgeAfter.getTime() - 365 * 86_400_000),
      purgeAfter,
    },
  });
  recordIds.push(record.id);
  return record.id;
}

test("purge removes only records whose term has passed", async () => {
  const now = new Date();
  const expired = await mkRecord("expired", new Date(now.getTime() - 60_000));
  const boundary = await mkRecord("boundary", now);
  const kept = await mkRecord("kept", new Date(now.getTime() + 86_400_000));

  const result = await purgeExpiredIdentityRecords({ db, now });
  assert.ok(result.deleted >= 2);
  const left = await db.identityRetentionRecord.findMany({
    where: { id: { in: [expired, boundary, kept] } },
    select: { id: true },
  });
  assert.deepEqual(left.map((r) => r.id), [kept]);
  assert.deepEqual(await purgeExpiredIdentityRecords({ db, now }), { deleted: 0 }, "idempotent");
});

test("cron route requires the Bearer secret and purges expired records", async () => {
  const savedSecret = env.CRON_SECRET;
  env.CRON_SECRET = "test-cron-secret-not-real";
  try {
    const { GET } = await import("../../../app/api/cron/identity-retention-purge/route");
    const call = (token?: string) =>
      GET(
        new NextRequest("http://localhost/api/cron/identity-retention-purge", {
          headers: token ? { authorization: token } : {},
        }),
      );

    assert.equal((await call()).status, 401);
    assert.equal((await call("Bearer wrong")).status, 401);

    const expired = await mkRecord("cron", new Date(Date.now() - 60_000));
    const ok = await call("Bearer test-cron-secret-not-real");
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { success: boolean; deleted: number };
    assert.equal(body.success, true);
    assert.ok(body.deleted >= 1);
    assert.equal(await db.identityRetentionRecord.count({ where: { id: expired } }), 0);
  } finally {
    restoreEnv("CRON_SECRET", savedSecret);
  }
});
