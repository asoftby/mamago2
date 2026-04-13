"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { getBusinessBillingSummary } from "@/server/services/billing/billingBusiness.service";
import { creditBusinessDeposit } from "@/server/services/billing/billingAccount.service";

const depositSchema = z.object({
  amount: z.number().min(1, "Минимальная сумма — 1 BYN").max(10000, "Максимальная сумма — 10 000 BYN"),
});

export type DepositActionResult =
  | { ok: true; newBalance: number }
  | { ok: false; error: string };

export async function depositBalanceAction(input: { amount: number }): Promise<DepositActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Сессия истекла. Обновите страницу." };

  const business = await getMyBusiness(user.id);
  if (!business) return { ok: false, error: "Бизнес не найден." };

  const parsed = depositSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Неверная сумма." };
  }

  const billing = await getBusinessBillingSummary(business.id);
  if (!billing) return { ok: false, error: "Биллинг-аккаунт не найден." };

  await creditBusinessDeposit({
    accountId: billing.account.id,
    amount: parsed.data.amount,
    description: "Пополнение депозита",
  });

  revalidatePath("/business/dashboard");
  revalidatePath("/business/billing/deposit");

  const newBalance = billing.account.depositBalance.toNumber() + parsed.data.amount;
  return { ok: true, newBalance };
}
