import { Metadata } from "next";
import { NotificationCenter } from "@/components/business/notifications/NotificationCenter";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";

export const metadata: Metadata = {
  title: "Уведомления | Business",
};

export default function BusinessNotificationsPage() {
  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="КАБИНЕТ"
        title="Уведомления"
        description="Последние события, новости и действия, которые требуют внимания."
      />
      <NotificationCenter stream="business" hideHeader />
    </div>
  );
}
