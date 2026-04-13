import { requireRole } from "@/lib/auth/server";
import { Role } from "@prisma/client";
import { listAdminBroadcasts } from "@/server/services/admin/broadcast.service";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BroadcastsListClient } from "./BroadcastsListClient";

export default async function AdminBroadcastsPage() {
  await requireRole([Role.ADMIN, Role.MODERATOR]);

  const { items, total } = await listAdminBroadcasts({ limit: 50 });

  return (
    <div className="p-6 md:p-4 space-y-6">
      <AdminPageHeader
        title="Сообщения"
        subtitle="Новости, объявления и системные уведомления для пользователей"
        showBackButton={false}
        actions={
          <a
            href="/admin/broadcasts/new"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            + Создать сообщение
          </a>
        }
      />

      <BroadcastsListClient initialItems={items} total={total} />
    </div>
  );
}
