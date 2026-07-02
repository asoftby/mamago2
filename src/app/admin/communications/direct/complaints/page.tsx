import Link from "next/link";
import { DirectComplaintStatus } from "@prisma/client";
import { adminPath } from "@/lib/routing/surface";
import { cn } from "@/lib/utils";
import { getAdminComplaints } from "@/server/services/direct/directAdmin.service";
import { ThreadNumber } from "@/components/direct/ThreadNumber";
import { ComplaintResolveForm } from "./ComplaintResolveForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FILTERS: { key: DirectComplaintStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "Все" },
  { key: DirectComplaintStatus.PENDING, label: "В ожидании" },
  { key: DirectComplaintStatus.REVIEWED, label: "Рассмотренные" },
  { key: DirectComplaintStatus.DISMISSED, label: "Отклонённые" },
  { key: DirectComplaintStatus.ACTION_TAKEN, label: "Приняты меры" },
];

const BASE_PATH = adminPath("/communications/direct/complaints");
const DIALOGS_PATH = adminPath("/communications/direct/dialogs");

export default async function AdminDirectComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = FILTERS.some((f) => f.key === params.status)
    ? (params.status as DirectComplaintStatus | "ALL")
    : "ALL";

  const complaints = await getAdminComplaints(statusFilter === "ALL" ? undefined : statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "ALL" ? BASE_PATH : `${BASE_PATH}?status=${f.key}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition",
              statusFilter === f.key
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Повод</th>
              <th className="px-4 py-3">Причина</th>
              <th className="px-4 py-3">Заявитель</th>
              <th className="px-4 py-3">Бизнес / Клиент</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {complaints.map((c) => (
              <tr key={c.id} className="align-top hover:bg-stone-50/60">
                <td className="px-4 py-3">
                  <Link
                    href={`${DIALOGS_PATH}/${c.threadId}`}
                    className="font-medium text-stone-900 underline underline-offset-2"
                  >
                    <ThreadNumber value={c.threadNumber} />
                  </Link>
                </td>
                <td className="px-4 py-3 text-stone-700">
                  <div>{c.reason}</div>
                  {c.comment && <div className="mt-0.5 text-xs text-stone-500">{c.comment}</div>}
                  {c.resolution && (
                    <div className="mt-1 rounded-lg bg-stone-50 px-2 py-1 text-xs text-stone-600">
                      Решение: {c.resolution}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-stone-700">{c.reporterName}</td>
                <td className="px-4 py-3 text-stone-500">
                  {c.businessName} / {c.customerName}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{c.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {c.status === DirectComplaintStatus.PENDING && <ComplaintResolveForm complaintId={c.id} />}
                </td>
              </tr>
            ))}
            {complaints.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                  Жалоб нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
