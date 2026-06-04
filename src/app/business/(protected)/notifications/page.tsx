import { Metadata } from "next";
import { NotificationCenter } from "@/components/business/notifications/NotificationCenter";

export const metadata: Metadata = {
  title: "Уведомления | Business",
};

export default function BusinessNotificationsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <NotificationCenter stream="business" />
    </main>
  );
}
