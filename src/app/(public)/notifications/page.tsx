import { getCurrentUser } from "@/lib/auth/server";
import { NotificationCenter } from "@/components/business/notifications/NotificationCenter";
import { redirectToLogin } from "@/lib/auth/requireAuthRedirect";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) {
    await redirectToLogin({ redirectTo: "/notifications" });
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <NotificationCenter stream="user" />
    </main>
  );
}
