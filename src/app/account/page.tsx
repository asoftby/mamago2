import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";

/**
 * Точка входа «Аккаунт» — единый профиль для всех ролей.
 */
export default async function AccountEntryPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  redirect("/me");
}
