"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { isBoostOptionId } from "@/lib/billing/boostOptions";
import { purchaseEventBoost } from "@/server/services/billing/eventBoostPurchase.service";

const schema = z.object({
  activityId: z.string().min(1),
  optionId: z.string().refine(isBoostOptionId),
  requestKey: z.string().trim().min(8).max(128),
  targetRegionIds: z.array(z.string().min(1)).max(6).default([]),
});

export async function purchaseEventBoostAction(input: z.input<typeof schema>) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Сессия истекла." };
  const business = await getMyBusiness(user.id);
  if (!business) return { ok: false as const, error: "Бизнес не найден." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Некорректный запрос Boost." };
  try {
    const result = await purchaseEventBoost({ ...parsed.data, businessId: business.id });
    revalidatePath("/business/events");
    revalidatePath("/business/billing");
    return { ok: true as const, boostId: result.boostId, idempotentReplay: result.idempotentReplay };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Не удалось купить Boost." };
  }
}
