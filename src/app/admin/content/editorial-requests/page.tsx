import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EditorialRequestStatusBadge } from "@/components/admin/editorial/EditorialRequestStatusBadge";
import { listEditorialRequests } from "@/server/editorial/editorialRequestService";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

export default async function AdminEditorialRequestsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    redirect("/login?from=/admin/content/editorial-requests");
  }

  const items = await listEditorialRequests();

  return (
    <div className="space-y-6 p-6 md:p-4">
      <AdminPageHeader
        title="Редакционные запросы"
        subtitle="Внутренние редакционные запросы с preview бизнесов по опубликованным офферам."
        actions={
          <Link
            href="/admin/content/editorial-requests/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" />
            Создать запрос
          </Link>
        }
      />

      <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Criteria</th>
              <th className="px-4 py-3 font-medium">Deadline</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-stone-500">
                  Пока нет редакционных запросов. Создайте первый, чтобы проверить matching preview.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-4 font-medium text-stone-900">
                    {item.title}
                  </td>
                  <td className="px-4 py-4 text-stone-600">
                    {item.city?.name ?? "All cities"}
                  </td>
                  <td className="px-4 py-4">
                    <EditorialRequestStatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-4 text-stone-600">
                    {item.criteriaSummary.discoverySignalCount} signals /{" "}
                    {item.criteriaSummary.classChipCount} chips
                  </td>
                  <td className="px-4 py-4 text-stone-600">
                    {formatDate(item.deadlineAt)}
                  </td>
                  <td className="px-4 py-4 text-stone-600">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="px-4 py-4 text-stone-600">
                    {formatDate(item.updatedAt)}
                  </td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/admin/content/editorial-requests/${item.id}`}
                      className="text-sm font-medium text-sky-700 hover:text-sky-800"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
