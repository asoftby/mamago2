import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EditorialRequestEditorClient } from "@/components/admin/editorial/EditorialRequestEditorClient";
import { EditorialRequestMatchesPanel } from "@/components/admin/editorial/EditorialRequestMatchesPanel";
import { EditorialRequestStatusBadge } from "@/components/admin/editorial/EditorialRequestStatusBadge";
import {
  getEditorialRequestById,
  listEditorialRequestFormCatalog,
} from "@/server/editorial/editorialRequestService";
import { previewEditorialRequestMatchesByRequestId } from "@/server/editorial/editorialRequestMatchingService";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

export default async function AdminEditorialRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    redirect("/login");
  }

  const { id } = await params;

  const [request, catalog, matches] = await Promise.all([
    getEditorialRequestById(id),
    listEditorialRequestFormCatalog(),
    previewEditorialRequestMatchesByRequestId(id),
  ]);

  if (!request || !matches) {
    notFound();
  }

  return (
    <div className="space-y-6 p-6 md:p-4">
      <AdminPageHeader
        title={request.title}
        subtitle="Редактор критериев и preview matched businesses для Phase 1."
        showBackButton
      />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Status
          </div>
          <div className="mt-3">
            <EditorialRequestStatusBadge status={request.status} />
          </div>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-[0.16em] text-stone-500">
            City
          </div>
          <div className="mt-3 text-sm font-medium text-stone-900">
            {request.city?.name ?? "All cities"}
          </div>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Created
          </div>
          <div className="mt-3 text-sm font-medium text-stone-900">
            {formatDate(request.createdAt)}
          </div>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Updated
          </div>
          <div className="mt-3 text-sm font-medium text-stone-900">
            {formatDate(request.updatedAt)}
          </div>
        </div>
      </div>

      <EditorialRequestEditorClient
        initialRequest={request}
        cities={catalog.cities}
        signalGroups={catalog.signalGroups}
        classChips={catalog.classChips}
      />

      <EditorialRequestMatchesPanel matches={matches} />
    </div>
  );
}
