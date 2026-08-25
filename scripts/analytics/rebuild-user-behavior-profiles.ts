/**
 * Analytics Contract v1 — controlled UserBehaviorProfile rebuild.
 *
 * DRY-RUN by default (no writes):
 *   set -a; source .env; set +a
 *   pnpm exec tsx scripts/analytics/rebuild-user-behavior-profiles.ts
 *
 * One user:
 *   pnpm exec tsx scripts/analytics/rebuild-user-behavior-profiles.ts --user=<userId>
 *
 * Limit a dry-run:
 *   pnpm exec tsx scripts/analytics/rebuild-user-behavior-profiles.ts --limit=100
 *
 * APPLY is intentionally guarded and must be run with behavior-event writes
 * paused / maintenance mode enabled:
 *   pnpm exec tsx scripts/analytics/rebuild-user-behavior-profiles.ts \
 *     --apply --maintenance-confirm
 *
 * Domain tables are untouched. Only the derived UserBehaviorProfile cache is
 * upserted from historical UserEvent rows.
 */
import { prismaBase } from "@/lib/prisma";
import {
  listUsersWithBehaviorEvents,
  rebuildBehaviorProfileForUser,
  type BehaviorProfileRebuildField,
} from "@/server/services/analytics/behaviorProfileRebuild.service";

function argValue(name: string): string | null {
  const prefix = `${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function positiveInt(name: string, fallback: number): number {
  const raw = argValue(name);
  if (raw == null) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return n;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const maintenanceModeConfirmed = process.argv.includes("--maintenance-confirm");
  const oneUser = argValue("--user")?.trim() || null;
  const limit = positiveInt("--limit", Number.MAX_SAFE_INTEGER);
  const batchSize = Math.min(positiveInt("--batch-size", 100), 1000);

  if (apply && !maintenanceModeConfirmed) {
    throw new Error(
      "Refusing APPLY. Pause behavior-event writes / enable maintenance mode, then pass --maintenance-confirm.",
    );
  }

  console.log(
    `=== UserBehaviorProfile rebuild — ${apply ? "APPLY" : "DRY-RUN"} ===`,
  );
  if (apply) {
    console.warn(
      "WRITE MODE: only derived UserBehaviorProfile rows are updated; UserEvent/domain tables are not modified.",
    );
  }

  let processed = 0;
  let changed = 0;
  let applied = 0;
  let skippedNoEvents = 0;
  const fieldCounts = new Map<BehaviorProfileRebuildField, number>();

  const processUser = async (userId: string) => {
    const result = await rebuildBehaviorProfileForUser({
      userId,
      apply,
      maintenanceModeConfirmed,
    });
    processed += 1;
    if (result.changed) changed += 1;
    if (result.applied) applied += 1;
    if (result.skippedReason === "no_events") skippedNoEvents += 1;
    for (const field of result.changedFields) {
      fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
    }

    if (result.changed || result.skippedReason) {
      console.log(
        `${apply ? (result.applied ? "+" : "=") : "would"} user=${userId} events=${result.eventCount}` +
          (result.changedFields.length
            ? ` changed=[${result.changedFields.join(", ")}]`
            : "") +
          (result.skippedReason ? ` skipped=${result.skippedReason}` : ""),
      );
    }
  };

  if (oneUser) {
    await processUser(oneUser);
  } else {
    let afterUserId: string | null = null;
    while (processed < limit) {
      const take = Math.min(batchSize, limit - processed);
      const ids = await listUsersWithBehaviorEvents({
        take,
        afterUserId,
      });
      if (ids.length === 0) break;
      for (const userId of ids) {
        await processUser(userId);
      }
      afterUserId = ids.at(-1) ?? null;
      if (ids.length < take) break;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Processed:       ${processed}`);
  console.log(`Profiles differ: ${changed}`);
  console.log(`Applied:         ${applied}`);
  console.log(`No events:       ${skippedNoEvents}`);
  if (fieldCounts.size > 0) {
    console.log("Changed fields:");
    for (const [field, count] of [...fieldCounts.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(`  ${field}: ${count}`);
    }
  }

  if (!apply && changed > 0) {
    console.log(
      "\nDry-run only. Review the diff summary; apply only during a maintenance window with --apply --maintenance-confirm.",
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
