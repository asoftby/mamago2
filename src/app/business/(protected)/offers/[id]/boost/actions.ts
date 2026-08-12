"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { isBoostOptionId } from "@/lib/billing/boostOptions";
import { purchaseOfferBoost } from "@/server/services/billing/boostPurchase.service";

const purchaseSchema = z.object({
  offerId: z.string().min(1),
  optionId: z.string().refine(isBoostOptionId),
  requestKey: z.string().trim().min(8).max(128),
});

export async function purchaseOfferBoostAction(input: z.input<typeof purchaseSchema>) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Сессия истекла." };

  const business = await getMyBusiness(user.id);
  if (!business) return { ok: false as const, error: "Бизнес не найден." };

  const parsed = purchaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Некорректный запрос Boost." };

  try {
    const result = await purchaseOfferBoost({
      businessId: business.id,
      offerId: parsed.data.offerId,
      optionId: parsed.data.optionId,
      requestKey: parsed.data.requestKey,
    });
    revalidatePath("/business/offers");
    revalidatePath("/business/billing");
    return {
      ok: true as const,
      boostId: result.boost.id,
      idempotentReplay: result.idempotentReplay,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Не удалось купить Boost.",
    };
  }
}
