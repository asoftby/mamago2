import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getPreferences } from "@/server/services/notificationPreference.service";
import { Container } from "@/components/ui/Container";
import { NotificationPreferencesClient } from "./NotificationPreferencesClient";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Настройки уведомлений | mamaGo" };

export default async function NotificationSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const preferences = await getPreferences(user.id, user.role);

  return (
    <div className="min-h-screen bg-background py-8">
      <Container className="max-w-2xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Link
              href="/me"
              className="flex items-center justify-center h-9 w-9 rounded-full bg-white border border-neutral-200 text-neutral-500 hover:text-neutral-900 transition-colors shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">Уведомления</h1>
              <p className="text-sm text-neutral-400 mt-0.5">Выберите как получать уведомления</p>
            </div>
          </div>

          <NotificationPreferencesClient initialPreferences={preferences} />
        </div>
      </Container>
    </div>
  );
}
