import Link from "next/link";
import { adminPath } from "@/lib/routing/surface";
import { cn } from "@/lib/utils";
import { getAdminDialogs, type AdminDialogFilter } from "@/server/services/direct/directAdmin.service";
import { ThreadNumber } from "@/components/direct/ThreadNumber";
import { StatusBadge } from "@/components/direct/StatusBadge";
import { UnreadBadge } from "@/components/direct/UnreadBadge";
import { DialogSearchForm } from "./DialogSearchForm";
import { TableContainer } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FILTERS: { key: AdminDialogFilter; label: string }[] = [
  { key: "ALL", label: "Все" },
  { key: "ACTIVE", label: "Активные" },
  { key: "NO_BUSINESS_REPLY", label: "Без ответа бизнеса" },
  { key: "WITH_COMPLAINTS", label: "С жалобами" },
  { key: "BLOCKED", label: "Заблокированные" },
  { key: "COMPLETED", label: "Завершённые" },
  { key: "ARCHIVE", label: "Архив" },
];

const BASE_PATH = adminPath("/communications/direct/dialogs");

export default async function AdminDirectDialogsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const params = await searchParams;
  const filter = (FILTERS.some((f) => f.key === params.filter) ? params.filter : "ALL") as AdminDialogFilter;
  const search = params.q;

  const dialogs = await getAdminDialogs(filter, search);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`${BASE_PATH}?filter=${f.key}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                filter === f.key
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <DialogSearchForm basePath={BASE_PATH} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200">
        <TableContainer minWidthClassName="min-w-[900px]" scrollLabel="Таблица диалогов, прокручивается по горизонтали">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Бизнес</th>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Последний повод</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Поводов</th>
              <th className="px-4 py-3">Последнее сообщение</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {dialogs.map((d) => (
              <tr key={d.key} className="hover:bg-stone-50/60">
                <td className="px-4 py-3 font-medium text-stone-900">{d.businessName}</td>
                <td className="px-4 py-3 text-stone-700">{d.customerName}</td>
                <td className="px-4 py-3 text-stone-700">
                  <ThreadNumber value={d.latestThreadNumber} /> · {d.latestPublicationTitle}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={d.status} />
                    {d.hasComplaints && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        жалоба
                      </span>
                    )}
                    {d.hiddenMessageCount > 0 && (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                        скрыто: {d.hiddenMessageCount}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-stone-700">{d.occasionCount}</td>
                <td className="px-4 py-3 text-stone-500">
                  <div className="flex items-center gap-2">
                    <span className="max-w-xs truncate">{d.lastMessagePreview ?? "—"}</span>
                    <UnreadBadge count={d.unreadCount} />
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`${BASE_PATH}/${d.latestThreadId}`}
                    className="text-sm font-medium text-stone-900 underline underline-offset-2"
                  >
                    Открыть
                  </Link>
                </td>
              </tr>
            ))}
            {dialogs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                  Ничего не найдено
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </TableContainer>
      </div>
    </div>
  );
}
