import { requireRole } from "@/lib/auth/server";
import { Role } from "@prisma/client";
import { AdminOrdersClient } from "./AdminOrdersClient";

export default async function AdminOrdersPage() {
  await requireRole([Role.ADMIN]);

  return (
    <div className="p-6 md:p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Заказы</h1>
          <p className="text-sm text-gray-600 mt-1">
            Read-only список всех заявок и броней по сервису
          </p>
        </div>
      </div>

      <AdminOrdersClient />
    </div>
  );
}
