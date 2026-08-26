"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import {
  createDailyFreeBoost,
  type FreeBoostPublicationType,
} from "@/server/services/promotion/dailyFreeBoost.service";

const schema = z.object({
  publicationId: z.string().min(1),
  publicationType: z.enum(["EVENT", "OFFER"]),
});

export async function createDailyFreeBoostAction(input: {
  publicationId: string;
  publicationType: FreeBoostPublicationType;
}) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Сессия истекла." };

  const business = await getMyBusiness(user.id);
  if (!business) return { ok: false as const, error: "Бизнес не найден." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Не удалось определить публикацию." };
  }

  try {
    await createDailyFreeBoost({
      businessId: business.id,
      userId: user.id,
      ...parsed.data,
    });
    revalidatePath("/business/dashboard");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось поднять публикацию.",
    };
  }
}
