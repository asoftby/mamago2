/**
 * Inbox purge smoke (forward-to-plan spec v1.3, section 15, purge smoke criterion).
 *
 * Creates synthetic InboxItem/InboxItemPart rows carrying a unique marker text
 * and a non-empty draft (statuses RECEIVED, DRAFT_READY, FAILED, CONFIRMED with
 * purgeAfter in the past, plus one item older than 30 days and one unexpired
 * control), calls the purge exactly as cron does (GET /api/cron/inbox-purge
 * with the Bearer CRON_SECRET), then checks with SQL that:
 *   - every expired part has text IS NULL and every expired item draft IS NULL;
 *   - the item older than 30 days is gone;
 *   - the unexpired control item is untouched;
 *   - the marker is found in no column of the Inbox* tables or PlanItem.
 * Prints only PASS/FAIL lines and numbers (never the marker, texts, secrets or
 * connection strings), removes its synthetic rows, exits 0 PASS / 1 FAIL / 2 refused.
 *
 * Usage:
 *   node dist/ops/inbox-purge-smoke.js [--base-url=http://127.0.0.1:3000] [--confirm-host=<db host>]
 * A non-local database host is refused unless --confirm-host=<that host> is given.
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

type Check = { name: string; pass: boolean; value: number };

function argValue(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function databaseHost(): string | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host) || host.endsWith(".localhost");
}

async function main(): Promise<number> {
  if (process.argv.includes("--help")) {
    console.log("inbox-purge-smoke [--base-url=URL] [--confirm-host=DB_HOST]");
    return 0;
  }

  const host = databaseHost();
  if (!host) {
    console.log("PURGE_SMOKE REFUSED: DATABASE_URL is missing or not a URL");
    return 2;
  }
  if (!isLocalHost(host) && argValue("confirm-host") !== host) {
    console.log(`PURGE_SMOKE REFUSED: database host "${host}" is not local; re-run with --confirm-host=${host} to confirm`);
    return 2;
  }

  const secret = process.env.CRON_SECRET?.trim();
  const baseUrl = (argValue("base-url") ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
  const suffix = randomBytes(6).toString("hex");
  const marker = `PURGE_SMOKE_${suffix}`;
  const controlMarker = `PURGE_SMOKE_KEEP_${suffix}`;
  const userId = `purge-smoke-${suffix}`;
  const db = new PrismaClient();
  const checks: Check[] = [];
  let httpStatus = 0;
  let created = 0;

  try {
    await db.user.create({ data: { id: userId, email: `${userId}@example.invalid` } });

    const past = new Date(Date.now() - 60_000);
    const make = async (
      status: "RECEIVED" | "DRAFT_READY" | "FAILED" | "CONFIRMED",
      options: { purgeAfter: Date; createdAt?: Date; text: string; ordinal: number },
    ) => {
      const item = await db.inboxItem.create({
        data: {
          userId,
          environment: "DEV",
          telegramChatId: BigInt(1),
          sourceKind: "TEXT",
          anchorAt: new Date(),
          anchorIsForward: false,
          debounceUntil: new Date(),
          status,
          purgeAfter: options.purgeAfter,
          ...(options.createdAt ? { createdAt: options.createdAt } : {}),
          draft: { text: options.text },
          parts: {
            create: {
              environment: "DEV",
              telegramUpdateId: BigInt(Date.now()) * BigInt(1000) + BigInt(options.ordinal),
              telegramMessageId: options.ordinal,
              kind: "TEXT",
              text: options.text,
              position: 0,
            },
          },
        },
        select: { id: true },
      });
      created += 1;
      return item.id;
    };

    const expiredIds: string[] = [];
    let ordinal = 0;
    for (const status of ["RECEIVED", "DRAFT_READY", "FAILED", "CONFIRMED"] as const) {
      expiredIds.push(await make(status, { purgeAfter: past, text: marker, ordinal: (ordinal += 1) }));
    }
    const oldId = await make("CONFIRMED", {
      purgeAfter: past,
      createdAt: new Date(Date.now() - 31 * DAY_MS),
      text: marker,
      ordinal: (ordinal += 1),
    });
    const controlId = await make("DRAFT_READY", {
      purgeAfter: new Date(Date.now() + 7 * DAY_MS),
      text: controlMarker,
      ordinal: (ordinal += 1),
    });

    // Same path as cron: authenticated GET to the purge route.
    try {
      const response = await fetch(`${baseUrl}/api/cron/inbox-purge`, {
        headers: secret ? { authorization: `Bearer ${secret}` } : {},
      });
      httpStatus = response.status;
    } catch {
      httpStatus = 0;
    }
    checks.push({ name: "purge_route_ok", pass: httpStatus === 200, value: httpStatus });

    const partsWithText = await db.inboxItemPart.count({ where: { inboxItemId: { in: expiredIds }, text: { not: null } } });
    checks.push({ name: "expired_parts_text_null", pass: partsWithText === 0, value: partsWithText });

    const draftRows = await db.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM "InboxItem" WHERE id = ANY(${expiredIds}) AND draft IS NOT NULL`;
    const draftsLeft = Number(draftRows[0]?.n ?? 0);
    checks.push({ name: "expired_drafts_null", pass: draftsLeft === 0, value: draftsLeft });

    const oldLeft = await db.inboxItem.count({ where: { id: oldId } });
    checks.push({ name: "old_item_deleted", pass: oldLeft === 0, value: oldLeft });

    const controlRows = await db.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n FROM "InboxItem" i
        JOIN "InboxItemPart" p ON p."inboxItemId" = i.id
       WHERE i.id = ${controlId} AND i.draft IS NOT NULL AND p.text IS NOT NULL`;
    const controlIntact = Number(controlRows[0]?.n ?? 0);
    checks.push({ name: "unexpired_control_untouched", pass: controlIntact === 1, value: controlIntact });

    // Marker search across every text/json column of Inbox* tables and PlanItem.
    const columns = await db.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (table_name LIKE 'Inbox%' OR table_name = 'PlanItem')
         AND (data_type IN ('text', 'character varying', 'json', 'jsonb') OR udt_name = '_text')`;
    let markerHits = 0;
    for (const { table_name, column_name } of columns) {
      const rows = await db.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT count(*) AS n FROM "${table_name.replace(/"/g, '""')}" WHERE "${column_name.replace(/"/g, '""')}"::text LIKE $1`,
        `%${marker}%`,
      );
      markerHits += Number(rows[0]?.n ?? 0);
    }
    checks.push({ name: "marker_not_found", pass: markerHits === 0, value: markerHits });
  } catch {
    checks.push({ name: "smoke_ran_without_errors", pass: false, value: 0 });
  } finally {
    let leftovers = -1;
    try {
      await db.inboxItem.deleteMany({ where: { userId } });
      await db.user.deleteMany({ where: { id: userId } });
      leftovers = await db.inboxItem.count({ where: { userId } });
    } catch {
      /* reported below */
    }
    checks.push({ name: "synthetic_rows_removed", pass: leftovers === 0, value: leftovers });
    await db.$disconnect().catch(() => undefined);
  }

  const failed = checks.filter((check) => !check.pass);
  for (const check of checks) console.log(`check ${check.name}: ${check.pass ? "PASS" : "FAIL"} (${check.value})`);
  console.log(`PURGE_SMOKE ${failed.length === 0 ? "PASS" : "FAIL"} items_created=${created} checks=${checks.length} failed=${failed.length}`);
  return failed.length === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  () => {
    console.log("PURGE_SMOKE FAIL unexpected_error");
    process.exit(1);
  },
);
