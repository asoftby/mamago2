import Link from "next/link";
import { AdminDashboardBlock } from "../AdminDashboardBlock";
import type { WorkloadViewModel } from "@/lib/admin/dashboardViewModels";
import { getDashboardBlock } from "@/lib/admin/dashboardBlocks";
import { adminPath } from "@/lib/routing/surface";

function fmt(value: number | null): string {
  return value === null ? "Нет данных" : String(value);
}

export function OperationalLoadBlock({ model }: { model: WorkloadViewModel }) {
  const block = getDashboardBlock("workload");

  const rows: { label: string; value: number | null; href: string }[] = [
    { label: "Модерация", value: model.moderation.total, href: adminPath("/moderation/queue") },
    { label: "Import review", value: model.importReviewSize, href: adminPath("/import/review") },
    { label: "B2B заявки", value: model.b2bPendingSize, href: adminPath("/b2b/access-requests") },
    { label: "Ошибки доставки (1ч)", value: model.commsFailedDeliveries1h, href: adminPath("/communications/notifications/deliveries") },
  ];

  return (
    <AdminDashboardBlock title={block.title} size={block.size}>
      <div className="divide-y divide-gray-100">
        {rows.map((row) => (
          <Link
            key={row.label}
            href={row.href}
            className="flex items-center justify-between py-2 first:pt-0 last:pb-0 hover:text-gray-900 group"
          >
            <span className="text-sm text-gray-600 group-hover:underline">{row.label}</span>
            <span className={`text-sm font-medium ${row.value === null ? "text-gray-400" : "text-gray-900"}`}>
              {fmt(row.value)}
            </span>
          </Link>
        ))}
      </div>
    </AdminDashboardBlock>
  );
}
