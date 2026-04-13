import { requireRole } from "@/lib/auth/server";
import { Role } from "@prisma/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BroadcastForm } from "../BroadcastForm";

export default async function NewBroadcastPage() {
  await requireRole([Role.ADMIN, Role.MODERATOR]);

  return (
    <div className="p-6 md:p-4 space-y-6">
      <AdminPageHeader
        title="Новое сообщение"
        subtitle="Создание новости, объявления или системного уведомления"
        backHref="/admin/broadcasts"
      />
      <BroadcastForm mode="create" />
    </div>
  );
}
