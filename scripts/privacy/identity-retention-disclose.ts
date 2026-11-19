/**
 * Выдача данных предварительной идентификации удалённого аккаунта по запросу
 * уполномоченного государственного органа (постановление Совмина РБ № 850).
 *
 * Расшифровывает IdentityRetentionRecord офлайн-приватным ключом, который на
 * сервере постоянно НЕ хранится. Каждая выдача записывается в AdminAuditLog
 * (action IDENTITY_RETENTION_DISCLOSED, reason = реквизиты запроса) ДО вывода
 * данных. Данные печатаются только в stdout как JSON; в лог ничего не пишется.
 *
 * Usage (процедура: docs/privacy/identity-retention.md):
 *   IDENTITY_RETENTION_PRIVATE_KEY_PASSPHRASE=... \
 *   node dist/ops/identity-retention-disclose.js \
 *     --request-ref="Запрос № … от …" --operator="ФИО" \
 *     --private-key-file=/path/to/private.pem \
 *     (--user-id=ID | --phone=+375XXXXXXXXX | --email=a@b.c) \
 *     [--confirm-host=<db host>]
 * Exit codes: 0 found, 1 not found, 2 refused / bad arguments, 3 key error.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  IdentityRetentionKeyError,
  loadPrivateKey,
  matchesIdentitySelector,
  openIdentityEnvelope,
  type IdentityRetentionPayload,
} from "../../src/server/privacy/identityRetention/envelope";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : null;
}

function databaseHost(): string | null {
  try {
    return process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : null;
  } catch {
    return null;
  }
}

async function main(): Promise<number> {
  const requestRef = argValue("request-ref");
  const operator = argValue("operator");
  const keyFile = argValue("private-key-file");
  const userId = argValue("user-id");
  const phone = argValue("phone");
  const email = argValue("email");
  const selectors = [userId, phone, email].filter(Boolean).length;

  if (!requestRef || !operator || !keyFile || selectors !== 1) {
    console.error(
      "REFUSED: required --request-ref, --operator, --private-key-file and exactly one of --user-id / --phone / --email",
    );
    return 2;
  }

  const host = databaseHost();
  if (!host) {
    console.error("REFUSED: DATABASE_URL is missing or not a URL");
    return 2;
  }
  if (!LOCAL_HOSTS.has(host) && argValue("confirm-host") !== host) {
    console.error(`REFUSED: database host "${host}" is not local; re-run with --confirm-host=${host}`);
    return 2;
  }

  let privateKey: ReturnType<typeof loadPrivateKey>;
  try {
    privateKey = loadPrivateKey(
      readFileSync(keyFile, "utf8"),
      process.env.IDENTITY_RETENTION_PRIVATE_KEY_PASSPHRASE || undefined,
    );
  } catch (error) {
    const code = error instanceof IdentityRetentionKeyError ? error.code : "UNREADABLE";
    console.error(`KEY ERROR: ${code}`);
    return 3;
  }

  const db = new PrismaClient();
  try {
    const candidates = await db.identityRetentionRecord.findMany({
      where: { ...(userId ? { userId } : {}), purgeAfter: { gt: new Date() } },
      select: { id: true, userId: true, keyId: true, envelope: true, purgeAfter: true },
      orderBy: { agreementEndedAt: "desc" },
    });

    const found: Array<{ recordId: string; purgeAfter: string; identity: IdentityRetentionPayload }> = [];
    let otherKey = 0;
    for (const record of candidates) {
      // Purge is best effort; never disclose an already expired row even if
      // the scheduled purge job has been delayed.
      if (record.purgeAfter.getTime() <= Date.now()) continue;
      if (record.keyId !== privateKey.keyId) {
        otherKey += 1;
        continue;
      }
      const identity = openIdentityEnvelope(record.envelope, record.userId, privateKey);
      if (userId || matchesIdentitySelector(identity, { phone, email })) {
        found.push({ recordId: record.id, purgeAfter: record.purgeAfter.toISOString(), identity });
      }
    }

    if (otherKey > 0) console.error(`WARN: ${otherKey} record(s) sealed with another key were skipped`);
    const currentlyRetained = found.filter((item) => Date.parse(item.purgeAfter) > Date.now());
    if (currentlyRetained.length === 0) {
      console.error("NOT FOUND");
      return 1;
    }

    await db.adminAuditLog.createMany({
      data: currentlyRetained.map((item) => ({
        actorId: null,
        actorRole: "OPERATOR_CLI",
        action: "IDENTITY_RETENTION_DISCLOSED",
        entityType: "IdentityRetentionRecord",
        entityId: item.recordId,
        reason: requestRef,
        metadata: { operator, matchedBy: userId ? "userId" : phone ? "phone" : "email", keyId: privateKey.keyId },
      })),
    });

    // Recheck at output time; no disclosure after the one-year deadline.
    const toDisclose = currentlyRetained.filter((item) => Date.parse(item.purgeAfter) > Date.now());
    if (toDisclose.length === 0) {
      console.error("NOT FOUND");
      return 1;
    }
    process.stdout.write(`${JSON.stringify({ requestRef, records: toDisclose }, null, 2)}\n`);
    return 0;
  } finally {
    await db.$disconnect();
  }
}

main().then(
  (code) => process.exit(code),
  () => {
    console.error("FAILED: unexpected error (details withheld to avoid leaking identity data)");
    process.exit(2);
  },
);
