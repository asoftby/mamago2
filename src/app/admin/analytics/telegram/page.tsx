import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTelegramAnalytics } from "@/components/admin/analytics/AdminTelegramAnalytics";

export default function AdminTelegramAnalyticsPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <AdminPageHeader
        title="Telegram-бот"
        subtitle="Активность семей и скорость реакции бизнеса"
      />
      <AdminTelegramAnalytics />
    </div>
  );
}
