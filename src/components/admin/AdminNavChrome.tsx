import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { loadAdminNavCounts } from "@/lib/admin/loadAdminNavCounts";

export async function AdminHeaderWithNavCounts({
  userEmail,
  userDisplayName,
}: {
  userEmail?: string;
  userDisplayName?: string | null;
}) {
  const counts = await loadAdminNavCounts();
  return (
    <AdminHeader
      userEmail={userEmail}
      userDisplayName={userDisplayName}
      moderationCounts={counts.moderationCounts}
      b2bPendingVerificationCount={counts.b2bPendingVerificationCount}
    />
  );
}

export async function AdminSidebarWithNavCounts() {
  const counts = await loadAdminNavCounts();
  return (
    <AdminSidebar
      moderationCounts={counts.moderationCounts}
      b2bPendingVerificationCount={counts.b2bPendingVerificationCount}
    />
  );
}
