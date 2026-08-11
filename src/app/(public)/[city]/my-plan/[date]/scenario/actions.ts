"use server";

import { revalidatePath } from "next/cache";
import { redirectToLogin } from "@/lib/auth/requireAuthRedirect";
import { getCurrentUser } from "@/lib/auth/server";
import { listPlanItemsByDate } from "@/server/services/plan.service";
import { refreshDayScenario } from "@/server/services/dayScenario.service";

/** "Обновить сценарий" — recomputes the stored fingerprint from the current My Plan. */
export async function refreshDayScenarioAction(city: string, date: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    await redirectToLogin();
    return;
  }

  const items = await listPlanItemsByDate(user.id, date);
  await refreshDayScenario(user.id, date, items);

  revalidatePath(`/${city}/my-plan/${date}/scenario`);
}
