import { requireRole } from "@/lib/auth/server";
import { Role } from "@prisma/client";
import { AdminOrdersClient } from "../AdminOrdersClient";

/**
 * The canonical deep link for admin booking alerts opens the same right-hand
 * details drawer as clicking an order in the B2B → Заказы list.
 * The list remains behind it, so the administrator retains navigation context.
 */
export default async function AdminOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole([Role.ADMIN]);
  const { id } = await params;
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Заказы</h1>
        <p className="mt-1 text-sm text-gray-600">Все заявки и брони по сервису</p>
      </div>
      <AdminOrdersClient initialOrderId={id} />
    </div>
  );
}
