"use server";

import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";

export type DepositActionResult =
  | { ok: false; error: string };

export async function depositBalanceAction(input: { amount: number }): Promise<DepositActionResult> {
  void input;

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Сессия истекла. Обновите страницу." };

  const business = await getMyBusiness(user.id);
  if (!business) return { ok: false, error: "Бизнес не найден." };

  // TODO: Re-enable business self top-up only after payment provider integration
  // and server-side verification of the successful payment webhook.
  return {
    ok: false,
    error: "Онлайн-пополнение пока недоступно. Свяжитесь с менеджером mamaGo для зачисления средств.",
  };
}
