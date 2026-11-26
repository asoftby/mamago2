import type { Metadata } from "next";
import { NotificationCenter } from "@/components/business/notifications/NotificationCenter";

export const metadata: Metadata = {
  title: "Уведомления | Администратор",
};

export default function AdminNotificationsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <NotificationCenter stream="user" />
    </div>
  );
}
