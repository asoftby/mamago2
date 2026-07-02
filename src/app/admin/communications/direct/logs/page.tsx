import Link from "next/link";
import { adminPath } from "@/lib/routing/surface";
import { cn } from "@/lib/utils";
import {
  getDirectAuditLogsForAdmin,
  type DirectAuditEntityTypeFilter,
} from "@/server/services/direct/directAdmin.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FILTERS: { key: DirectAuditEntityTypeFilter; label: string }[] = [
  { key: "ALL", label: "Все" },
  { key: "DIRECT_THREAD", label: "Диалоги" },
  { key: "DIRECT_MESSAGE", label: "Сообщения" },
  { key: "DIRECT_COMPLAINT", label: "Жалобы" },
  { key: "DIRECT_RISK_SIGNAL", label: "Risk-сигналы" },
  { key: "DIRECT_PLATFORM_SETTINGS", label: "Настройки платформы" },
];

const BASE_PATH = adminPath("/communications/direct/logs");

export default async function AdminDirectLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string }>;
}) {
  const params = await searchParams;
  const entityType = (FILTERS.some((f) => f.key === params.entityType)
    ? params.entityType
    : "ALL") as DirectAuditEntityTypeFilter;

  const logs = await getDirectAuditLogsForAdmin(entityType);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "ALL" ? BASE_PATH : `${BASE_PATH}?entityType=${f.key}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition",
              entityType === f.key
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
              <th className="px-4 py-3">Когда</th>
              <th className="px-4 py-3">Действие</th>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3">Актор</th>
              <th className="px-4 py-3">Причина</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-stone-50/60">
                <td className="px-4 py-3 text-stone-500">{new Date(log.createdAt).toLocaleString("ru-RU")}</td>
                <td className="px-4 py-3 font-medium text-stone-900">{log.action}</td>
                <td className="px-4 py-3 text-stone-500">{log.entityType}</td>
                <td className="px-4 py-3 text-stone-700">
                  {log.actorName ?? "—"} <span className="text-xs text-stone-400">({log.actorRole})</span>
                </td>
                <td className="px-4 py-3 text-stone-500">{log.reason ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  {log.dialogHref && (
                    <Link href={log.dialogHref} className="text-sm font-medium text-stone-900 underline underline-offset-2">
                      Открыть диалог
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                  Записей нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
