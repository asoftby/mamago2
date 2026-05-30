import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminNotificationPoliciesClient } from "./AdminNotificationPoliciesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminCommunicationsNotificationsPage() {
  return (
    <div className="space-y-6 p-6 md:p-4">
      <AdminPageHeader
        title="Уведомления"
        subtitle="Управление сценариями, каналами и частотой отправки уведомлений."
        showBackButton
      />

      <AdminNotificationPoliciesClient />
    </div>
  );
}
