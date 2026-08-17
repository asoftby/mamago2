/**
 * operationsSignalPresentation.ts pure logic tests — no DB, no React.
 * Run: npx tsx src/app/admin/_lib/operationsSignalPresentation.test.ts
 */
import assert from "node:assert/strict";
import {
  isSignalNew,
  sortSignals,
  isHealthyEmpty,
  formatOpenedAge,
  formatFreshness,
  NODE_STATE_LABEL,
  NODE_STATE_STYLE,
  type SortableSignal,
} from "./operationsSignalPresentation";
import type { NodeState } from "@/server/ops/types";

function sig(
  id: string,
  severity: "CRITICAL" | "WARNING",
  openedAtIso: string,
  opts: { attentionChangedAtIso?: string; acknowledged?: boolean } = {},
): SortableSignal {
  return {
    id,
    severity,
    openedAt: new Date(openedAtIso),
    attentionChangedAt: opts.attentionChangedAtIso ? new Date(opts.attentionChangedAtIso) : new Date(openedAtIso),
    acknowledgedAt: opts.acknowledged ? new Date(openedAtIso) : null,
  };
}

function main() {
  const lastViewed = new Date("2026-06-15T10:00:00.000Z");

  // ---- isSignalNew ----
  {
    const newSig = sig("a", "CRITICAL", "2026-06-15T09:00:00.000Z", {
      attentionChangedAtIso: "2026-06-15T10:30:00.000Z", // after lastViewed
    });
    assert.equal(isSignalNew(newSig, lastViewed), true, "attentionChangedAt > lastViewedAt -> new");

    const notNewSig = sig("b", "CRITICAL", "2026-06-15T09:00:00.000Z", {
      attentionChangedAtIso: "2026-06-15T09:30:00.000Z", // before lastViewed
    });
    assert.equal(isSignalNew(notNewSig, lastViewed), false, "attentionChangedAt <= lastViewedAt -> not new");

    // openedAt itself is irrelevant to newness — only attentionChangedAt matters.
    const openedRecentlyButOldAttention = sig("c", "CRITICAL", "2026-06-15T11:00:00.000Z", {
      attentionChangedAtIso: "2026-06-15T09:00:00.000Z",
    });
    assert.equal(
      isSignalNew(openedRecentlyButOldAttention, lastViewed),
      false,
      "openedAt after lastViewedAt must NOT by itself make a signal new",
    );

    // acknowledged clears "new" regardless of attentionChangedAt timing.
    const ackedButRecentAttention = sig("d", "CRITICAL", "2026-06-15T09:00:00.000Z", {
      attentionChangedAtIso: "2026-06-15T10:30:00.000Z",
      acknowledged: true,
    });
    assert.equal(isSignalNew(ackedButRecentAttention, lastViewed), false, "acknowledged must never be new");

    // lastViewedAt === null (first-ever view) -> everything with attentionChangedAt is new.
    const anySig = sig("e", "WARNING", "2026-06-15T09:00:00.000Z");
    assert.equal(isSignalNew(anySig, null), true, "lastViewedAt=null -> new");
  }

  // ---- sortSignals: full frozen ordering ----
  {
    const newCritical = sig("new-critical", "CRITICAL", "2026-06-15T08:00:00.000Z", {
      attentionChangedAtIso: "2026-06-15T10:30:00.000Z",
    });
    const oldCritical = sig("old-critical", "CRITICAL", "2026-06-15T07:00:00.000Z", {
      attentionChangedAtIso: "2026-06-15T09:00:00.000Z",
    });
    const ackedCritical = sig("acked-critical", "CRITICAL", "2026-06-15T06:00:00.000Z", {
      attentionChangedAtIso: "2026-06-15T09:00:00.000Z",
      acknowledged: true,
    });
    const newWarning = sig("new-warning", "WARNING", "2026-06-15T08:30:00.000Z", {
      attentionChangedAtIso: "2026-06-15T10:45:00.000Z",
    });
    const oldWarning = sig("old-warning", "WARNING", "2026-06-15T07:30:00.000Z", {
      attentionChangedAtIso: "2026-06-15T09:15:00.000Z",
    });
    const ackedWarning = sig("acked-warning", "WARNING", "2026-06-15T06:30:00.000Z", {
      attentionChangedAtIso: "2026-06-15T09:15:00.000Z",
      acknowledged: true,
    });

    const shuffled = [ackedWarning, oldWarning, newWarning, ackedCritical, oldCritical, newCritical];
    const sorted = sortSignals(shuffled, lastViewed).map((s) => s.id);

    assert.deepEqual(sorted, [
      "new-critical",
      "old-critical",
      "acked-critical",
      "new-warning",
      "old-warning",
      "acked-warning",
    ]);
  }

  // ---- sortSignals: openedAt tiebreak within a bucket (older first) ----
  {
    const older = sig("older", "WARNING", "2026-06-15T07:00:00.000Z", { attentionChangedAtIso: "2026-06-15T09:00:00.000Z" });
    const newer = sig("newer", "WARNING", "2026-06-15T08:00:00.000Z", { attentionChangedAtIso: "2026-06-15T09:00:00.000Z" });
    const sorted = sortSignals([newer, older], lastViewed).map((s) => s.id);
    assert.deepEqual(sorted, ["older", "newer"], "within a bucket, older openedAt must come first");
  }

  // ---- formatOpenedAge ----
  {
    const now = new Date("2026-06-15T12:00:00.000Z");
    assert.equal(formatOpenedAge(new Date("2026-06-15T11:59:30.000Z"), now), "Открыт только что");
    assert.equal(formatOpenedAge(new Date("2026-06-15T11:30:00.000Z"), now), "Открыт 30 мин назад");
    assert.equal(formatOpenedAge(new Date("2026-06-15T09:00:00.000Z"), now), "Открыт 3 ч назад");
    assert.equal(formatOpenedAge(new Date("2026-06-12T12:00:00.000Z"), now), "Открыт 3 дня назад");
    assert.equal(formatOpenedAge(new Date("2026-06-14T12:00:00.000Z"), now), "Открыт 1 день назад");
    assert.equal(formatOpenedAge(new Date("2026-06-04T12:00:00.000Z"), now), "Открыт 11 дней назад");
  }

  // ---- formatFreshness ----
  {
    const now = new Date("2026-06-15T12:00:18.000Z");
    assert.equal(formatFreshness(new Date("2026-06-15T12:00:00.000Z"), now), "Обновлено 18 сек. назад");
    assert.equal(formatFreshness(new Date("2026-06-15T11:55:00.000Z"), now), "Обновлено 5 мин. назад");
    assert.equal(formatFreshness(new Date("2026-06-15T09:00:18.000Z"), now), "Обновлено 3 ч. назад");
  }

  // ---- isHealthyEmpty ----
  {
    assert.equal(isHealthyEmpty(false, 0, false), true, "fresh + no signals + no stale synthetic -> success");
    assert.equal(isHealthyEmpty(true, 0, false), false, "stale snapshot must never present as empty success");
    assert.equal(isHealthyEmpty(false, 0, true), false, "a stale synthetic signal must never be masked by empty state");
    assert.equal(isHealthyEmpty(false, 2, false), false, "visible signals present -> not empty");
  }

  // ---- node state presentation completeness ----
  {
    const states: NodeState[] = ["OK", "WARNING", "CRITICAL", "NO_DATA"];
    for (const state of states) {
      assert.ok(NODE_STATE_LABEL[state], `NODE_STATE_LABEL must cover ${state}`);
      assert.ok(NODE_STATE_STYLE[state], `NODE_STATE_STYLE must cover ${state}`);
    }
    assert.equal(NODE_STATE_LABEL.OK, "Работает");
    assert.equal(NODE_STATE_LABEL.WARNING, "Внимание");
    assert.equal(NODE_STATE_LABEL.CRITICAL, "Проблема");
    assert.equal(NODE_STATE_LABEL.NO_DATA, "Нет данных");
    // NO_DATA must never be styled as OK (neutral gray, not green).
    assert.notEqual(NODE_STATE_STYLE.NO_DATA.text, NODE_STATE_STYLE.OK.text);
    assert.notEqual(NODE_STATE_STYLE.NO_DATA.dot, NODE_STATE_STYLE.OK.dot);
  }

  console.log("operationsSignalPresentation.test.ts: OK");
}

main();
