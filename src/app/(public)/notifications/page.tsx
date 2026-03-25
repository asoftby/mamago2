import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { NotificationsCenterClient } from "./NotificationsCenterClient";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/notifications");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold text-neutral-900 mb-6">
        Уведомления
      </h1>
      <NotificationsCenterClient />
    </div>
  );
}
