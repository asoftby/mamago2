import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";

/**
 * Старый URL /notifications — основной UX через колокольчик и NotificationsModal.
 */
export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/me");
  }
  redirect("/me");
}
