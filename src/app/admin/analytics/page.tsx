import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminAnalyticsPageContent } from "@/components/admin/analytics/AdminAnalyticsPageContent";

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <AdminPageHeader
        title="Analytics"
        subtitle="User behavior, segments and content performance"
        backHref="/admin"
      />
      <AdminAnalyticsPageContent />
    </div>
  );
}
