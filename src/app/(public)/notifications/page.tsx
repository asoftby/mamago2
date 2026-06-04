import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { NotificationCenter } from "@/components/business/notifications/NotificationCenter";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/notifications");
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <NotificationCenter stream="user" />
    </main>
  );
}
