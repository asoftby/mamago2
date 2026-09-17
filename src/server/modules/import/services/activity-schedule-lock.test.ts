import assert from "node:assert/strict";
import { acquireActivityScheduleLock, activityScheduleLockKey } from "./activity-schedule-lock";

async function main() {
  assert.equal(
    activityScheduleLockKey("activity-123"),
    "mamago:activity-schedule:activity-123",
  );

  let captured = "";
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      captured = strings.reduce(
        (sql, part, index) => `${sql}${part}${index < values.length ? String(values[index]) : ""}`,
        "",
      );
      return [{ locked: 1 }];
    },
  };

  await acquireActivityScheduleLock(tx as never, "activity-123");

  assert.match(captured, /SELECT 1 AS locked FROM pg_advisory_xact_lock/);
  assert.match(captured, /mamago:activity-schedule:activity-123/);

  console.log("activity-schedule-lock: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
