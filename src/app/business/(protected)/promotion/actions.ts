"use server";

import { PromotionPublicationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import {
  PROMOTION_MAX_BUDGET,
  PROMOTION_MIN_BUDGET,
} from "@/lib/promotion/shared";
import {
  createPromotion,
  pausePromotion,
  resumePromotion,
} from "@/server/services/promotion/promotion.service";

export type PromotionActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
};

const createPromotionSchema = z.object({
  publicationId: z.string().min(1),
  publicationType: z.nativeEnum(PromotionPublicationType),
  budget: z.coerce
    .number()
    .min(PROMOTION_MIN_BUDGET, `Минимальный бюджет — ${PROMOTION_MIN_BUDGET} BYN.`)
    .max(PROMOTION_MAX_BUDGET, `Максимальный бюджет для MVP — ${PROMOTION_MAX_BUDGET} BYN.`),
});

const promotionIdSchema = z.object({
  promotionId: z.string().min(1),
});

function revalidatePromotionSurfaces() {
  revalidatePath("/business/promotion");
  revalidatePath("/business/promotion/campaigns");
  revalidatePath("/business/dashboard");
}

export async function createPromotionAction(input: {
  publicationId: string;
  publicationType: PromotionPublicationType;
  budget: number;
}): Promise<PromotionActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      error: "Сессия истекла. Обновите страницу и попробуйте снова.",
    };
  }

  const business = await getMyBusiness(user.id);
  if (!business) {
    return {
      ok: false,
      error: "Бизнес не найден.",
    };
  }

  const parsed = createPromotionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Не удалось запустить продвижение. Проверьте бюджет и публикацию.",
    };
  }

  try {
    await createPromotion({
      businessId: business.id,
      publicationId: parsed.data.publicationId,
      publicationType: parsed.data.publicationType,
      budget: parsed.data.budget,
    });

    revalidatePromotionSurfaces();

    return {
      ok: true,
      message: "Продвижение запущено. Расходы и результаты начнут появляться по мере реальных действий пользователей.",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось запустить продвижение.",
    };
  }
}

export async function pausePromotionAction(input: {
  promotionId: string;
}): Promise<PromotionActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      error: "Сессия истекла. Обновите страницу и попробуйте снова.",
    };
  }

  const business = await getMyBusiness(user.id);
  if (!business) {
    return {
      ok: false,
      error: "Бизнес не найден.",
    };
  }

  const parsed = promotionIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Не удалось определить продвижение.",
    };
  }

  await pausePromotion({
    businessId: business.id,
    promotionId: parsed.data.promotionId,
  });
  revalidatePromotionSurfaces();

  return {
    ok: true,
    message: "Продвижение поставлено на паузу.",
  };
}

export async function resumePromotionAction(input: {
  promotionId: string;
}): Promise<PromotionActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      error: "Сессия истекла. Обновите страницу и попробуйте снова.",
    };
  }

  const business = await getMyBusiness(user.id);
  if (!business) {
    return {
      ok: false,
      error: "Бизнес не найден.",
    };
  }

  const parsed = promotionIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Не удалось определить продвижение.",
    };
  }

  try {
    await resumePromotion({
      businessId: business.id,
      promotionId: parsed.data.promotionId,
    });
    revalidatePromotionSurfaces();

    return {
      ok: true,
      message: "Продвижение снова активно.",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось возобновить продвижение.",
    };
  }
}
