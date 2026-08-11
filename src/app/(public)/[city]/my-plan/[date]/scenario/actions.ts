"use server";

import { revalidatePath } from "next/cache";
import { redirectToLogin } from "@/lib/auth/requireAuthRedirect";
import { getCurrentUser } from "@/lib/auth/server";
import { listPlanItemsByDate } from "@/server/services/plan.service";
import {
  refreshDayScenario,
  setScenarioItemOverride,
  pruneScenarioItemOverrides,
} from "@/server/services/dayScenario.service";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type SetScenarioItemTimeResult = { ok: true } | { ok: false; error: string };

/** "Назначить время" / "Изменить время" for a genuinely flexible Scenario item. */
export async function setScenarioItemTimeAction(
  city: string,
  date: string,
  planItemId: string,
  time: string,
): Promise<SetScenarioItemTimeResult> {
  const user = await getCurrentUser();
  if (!user) {
    await redirectToLogin();
    return { ok: false, error: "UNAUTHENTICATED" };
  }

  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  if (typeof planItemId !== "string" || planItemId.length === 0 || planItemId.length > 64) {
    return { ok: false, error: "INVALID_INPUT" };
  }

  try {
    await setScenarioItemOverride(user.id, date, planItemId, new Date(`${date}T${time}:00`));
  } catch (error) {
    if (error instanceof Error && (error.message === "SCENARIO_NOT_FOUND" || error.message === "PLAN_ITEM_NOT_FOUND")) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  revalidatePath(`/${city}/my-plan/${date}/scenario`);
  return { ok: true };
}

/** "Обновить сценарий" — recomputes the stored fingerprint from the current My Plan. */
export async function refreshDayScenarioAction(city: string, date: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    await redirectToLogin();
    return;
  }

  const items = await listPlanItemsByDate(user.id, date);
  const scenario = await refreshDayScenario(user.id, date, items);
  // Overrides for PlanItems still present are kept untouched; only overrides
  // for items no longer on this date are pruned (newly-added items simply
  // have no override row yet, which is the correct "initialize normally"
  // behavior — nothing to do for them here).
  if (scenario) {
    await pruneScenarioItemOverrides(scenario.id, items.map((item) => item.id));
  }

  revalidatePath(`/${city}/my-plan/${date}/scenario`);
}
