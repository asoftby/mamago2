import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ReleaseHistoryPanel } from "@/components/admin/system/ReleaseHistoryPanel";
import { listReleases } from "@/server/services/release.service";

export default async function AdminSystemBuildPage() {
  const releases = await listReleases();

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <AdminPageHeader
        title="Сборка"
        subtitle="История версий и список изменений"
        backHref="/admin"
      />

      <ReleaseHistoryPanel initialReleases={releases} />
    </div>
  );
}
