import { requireRole } from "@/lib/auth/server";
import { Role } from "@prisma/client";
import { getAdminBroadcastById } from "@/server/services/admin/broadcast.service";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BroadcastForm } from "../../BroadcastForm";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditBroadcastPage({ params }: Props) {
  await requireRole([Role.ADMIN, Role.MODERATOR]);

  const { id } = await params;
  const broadcast = await getAdminBroadcastById(id);
  if (!broadcast) notFound();

  return (
    <div className="p-6 md:p-4 space-y-6">
      <AdminPageHeader
        title="Редактировать сообщение"
        subtitle={broadcast.title}
        backHref="/admin/broadcasts"
      />
      <BroadcastForm mode="edit" broadcast={broadcast} />
    </div>
  );
}
