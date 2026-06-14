import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EditorialRequestEditorClient } from "@/components/admin/editorial/EditorialRequestEditorClient";
import { listEditorialRequestFormCatalog } from "@/server/editorial/editorialRequestService";

export default async function AdminNewEditorialRequestPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    redirect("/login?from=/admin/content/editorial-requests/new");
  }

  const catalog = await listEditorialRequestFormCatalog();

  return (
    <div className="space-y-6 p-6 md:p-4">
      <AdminPageHeader
        title="Новый Editorial Request"
        subtitle="Phase 1: настраиваем критерии подбора и сохраняем preview без Telegram и биллинга."
        showBackButton
      />

      <EditorialRequestEditorClient
        initialRequest={null}
        cities={catalog.cities}
        signalGroups={catalog.signalGroups}
        classChips={catalog.classChips}
      />
    </div>
  );
}
