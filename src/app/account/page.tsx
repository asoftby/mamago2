import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { redirectToLogin } from "@/lib/auth/requireAuthRedirect";

/**
 * Точка входа «Аккаунт» — единый профиль для всех ролей.
 */
export default async function AccountEntryPage() {
  const user = await getCurrentUser();

  if (!user) {
    await redirectToLogin({ redirectTo: "/account" });
  }

  redirect("/me");
}
