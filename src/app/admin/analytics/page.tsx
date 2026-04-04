import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminAnalyticsPageContent } from "@/components/admin/analytics/AdminAnalyticsPageContent";

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6 p-6 md:p-4">
      <AdminPageHeader
        title="Analytics"
        subtitle="User behavior, segments and content performance"
        backHref="/admin"
      />
      <AdminAnalyticsPageContent />
    </div>
  );
}
