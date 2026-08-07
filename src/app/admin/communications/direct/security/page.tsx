import Link from "next/link";
import { DirectRiskSeverity, DirectRiskSignalType } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminPath } from "@/lib/routing/surface";
import { cn } from "@/lib/utils";
import { ThreadNumber } from "@/components/direct/ThreadNumber";
import { StatusBadge } from "@/components/direct/StatusBadge";
import { TableContainer } from "@/components/ui/table";
import {
  getDirectSafetyDashboard,
  type SafetySignalRow,
} from "@/server/services/direct/directAdmin.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SIGNAL_LABELS: Record<DirectRiskSignalType, string> = {
  CONTACT_PHONE: "Телефон",
  CONTACT_EMAIL: "Email",
  CONTACT_LINK: "Ссылка",
  CONTACT_TELEGRAM: "Telegram",
  CONTACT_WHATSAPP: "WhatsApp",
  CONTACT_INSTAGRAM: "Instagram",
  FLOOD_LOCK_TRIGGERED: "Флуд-лок",
  NO_REPLY_CAP_TRIGGERED: "Лимит без ответа",
  REPEATED_LIMIT_TRIGGERED: "Повторный нарушитель",
  COMPLAINT_OPENED: "Открыта жалоба",
  MESSAGE_HIDDEN: "Сообщение скрыто",
  THREAD_BLOCKED: "Диалог заблокирован",
};

const SEVERITY_CLASSES: Record<DirectRiskSeverity, string> = {
  LOW: "bg-stone-100 text-stone-600",
  MEDIUM: "bg-amber-50 text-amber-700",
  HIGH: "bg-orange-50 text-orange-700",
  CRITICAL: "bg-red-50 text-red-700",
};

const SEVERITY_LABELS: Record<DirectRiskSeverity, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
  CRITICAL: "Критичный",
};

function SeverityBadge({ severity }: { severity: DirectRiskSeverity }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", SEVERITY_CLASSES[severity])}>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}

const DIALOGS_PATH = adminPath("/communications/direct/dialogs");
const BASE_PATH = adminPath("/communications/direct/security");

function SignalTable({ rows, emptyLabel }: { rows: SafetySignalRow[]; emptyLabel: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200">
      <TableContainer minWidthClassName="min-w-[720px]" scrollLabel="Таблица risk-сигналов, прокручивается по горизонтали">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-4 py-3">Повод</th>
            <th className="px-4 py-3">Бизнес / Клиент</th>
            <th className="px-4 py-3">Сигнал</th>
            <th className="px-4 py-3">Severity</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Когда</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-stone-50/60">
              <td className="px-4 py-3">{s.threadNumber ? <ThreadNumber value={s.threadNumber} /> : "—"}</td>
              <td className="px-4 py-3 text-stone-700">
                {s.businessName ?? "—"} / {s.customerName ?? "—"}
              </td>
              <td className="px-4 py-3 text-stone-700">{SIGNAL_LABELS[s.signalType]}</td>
              <td className="px-4 py-3">
                <SeverityBadge severity={s.severity} />
              </td>
              <td className="px-4 py-3 text-stone-700">{s.score}</td>
              <td className="px-4 py-3 text-stone-500">{new Date(s.createdAt).toLocaleString("ru-RU")}</td>
              <td className="px-4 py-3 text-right">
                {s.dialogHref && (
                  <Link href={s.dialogHref} className="text-sm font-medium text-stone-900 underline underline-offset-2">
                    Открыть
                  </Link>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </TableContainer>
    </div>
  );
}

export default async function AdminDirectSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const windowDays = params.days === "30" ? 30 : 7;

  const dashboard = await getDirectSafetyDashboard(windowDays);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[7, 30].map((d) => (
            <Link
              key={d}
              href={`${BASE_PATH}?days=${d}`}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                windowDays === d ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200",
              )}
            >
              {d} дней
            </Link>
          ))}
        </div>
      </div>

      {/* 1. High risk dialogs */}
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Диалоги высокого риска</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-stone-200">
            <TableContainer minWidthClassName="min-w-[680px]" scrollLabel="Диалоги высокого риска, прокручивается по горизонтали">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Повод</th>
                  <th className="px-4 py-3">Бизнес / Клиент</th>
                  <th className="px-4 py-3">Risk score</th>
                  <th className="px-4 py-3">Уровень</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {dashboard.highRiskDialogs.map((d) => (
                  <tr key={`${d.businessId}:${d.customerUserId}`} className="hover:bg-stone-50/60">
                    <td className="px-4 py-3">
                      <ThreadNumber value={d.threadNumber} />
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {d.businessName} / {d.customerName}
                    </td>
                    <td className="px-4 py-3 text-stone-700">{d.score}</td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={d.level} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={d.dialogHref} className="text-sm font-medium text-stone-900 underline underline-offset-2">
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
                {dashboard.highRiskDialogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                      Диалогов высокого риска нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </TableContainer>
          </div>
        </CardContent>
      </Card>

      {/* 5. Repeated offenders */}
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Повторные нарушители</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-stone-200">
            <TableContainer minWidthClassName="min-w-[560px]" scrollLabel="Повторные нарушители, прокручивается по горизонтали">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Бизнес / Клиент</th>
                  <th className="px-4 py-3">Диалогов с триггерами</th>
                  <th className="px-4 py-3">Когда</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {dashboard.repeatedOffenders.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50/60">
                    <td className="px-4 py-3 text-stone-700">{r.businessName ?? r.customerName ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-700">{r.distinctThreadCount ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-500">{new Date(r.createdAt).toLocaleString("ru-RU")}</td>
                  </tr>
                ))}
                {dashboard.repeatedOffenders.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-stone-400">
                      Повторных нарушителей нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </TableContainer>
          </div>
        </CardContent>
      </Card>

      {/* 2. Recent risk signals */}
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Последние risk-сигналы</CardTitle>
        </CardHeader>
        <CardContent>
          <SignalTable rows={dashboard.recentSignals} emptyLabel="Сигналов нет" />
        </CardContent>
      </Card>

      {/* 3. Contact escape messages */}
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Признаки ухода из платформы</CardTitle>
        </CardHeader>
        <CardContent>
          <SignalTable rows={dashboard.contactEscapeMessages} emptyLabel="Ничего не найдено" />
        </CardContent>
      </Card>

      {/* 4. Flood / no-reply triggers */}
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Флуд-лок и лимит без ответа</CardTitle>
        </CardHeader>
        <CardContent>
          <SignalTable rows={dashboard.floodNoReplyTriggers} emptyLabel="Триггеров нет" />
        </CardContent>
      </Card>

      {/* 6. Blocked dialogs */}
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Заблокированные диалоги</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-stone-200">
            <TableContainer minWidthClassName="min-w-[560px]" scrollLabel="Заблокированные диалоги, прокручивается по горизонтали">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Повод</th>
                  <th className="px-4 py-3">Бизнес / Клиент</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {dashboard.blockedDialogs.map((d) => (
                  <tr key={d.key} className="hover:bg-stone-50/60">
                    <td className="px-4 py-3">
                      <ThreadNumber value={d.latestThreadNumber} />
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {d.businessName} / {d.customerName}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`${DIALOGS_PATH}/${d.latestThreadId}`}
                        className="text-sm font-medium text-stone-900 underline underline-offset-2"
                      >
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
                {dashboard.blockedDialogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-stone-400">
                      Заблокированных диалогов нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </TableContainer>
          </div>
        </CardContent>
      </Card>

      {/* 7. Hidden messages */}
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Скрытые сообщения</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-stone-200">
            <TableContainer minWidthClassName="min-w-[760px]" scrollLabel="Скрытые сообщения, прокручивается по горизонтали">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Повод</th>
                  <th className="px-4 py-3">Бизнес / Клиент</th>
                  <th className="px-4 py-3">Текст</th>
                  <th className="px-4 py-3">Причина</th>
                  <th className="px-4 py-3">Когда</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {dashboard.hiddenMessages.map((m) => (
                  <tr key={m.id} className="hover:bg-stone-50/60">
                    <td className="px-4 py-3">
                      <ThreadNumber value={m.threadNumber} />
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {m.businessName} / {m.customerName}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      <span className="line-clamp-2 max-w-md">{m.body}</span>
                    </td>
                    <td className="px-4 py-3 text-stone-500">{m.hiddenReason ?? "—"}</td>
                    <td className="px-4 py-3 text-stone-500">{new Date(m.hiddenAt).toLocaleString("ru-RU")}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={m.dialogHref} className="text-sm font-medium text-stone-900 underline underline-offset-2">
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
                {dashboard.hiddenMessages.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                      Скрытых сообщений нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </TableContainer>
          </div>
        </CardContent>
      </Card>

      {/* 8. Open complaints */}
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Открытые жалобы</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-stone-200">
            <TableContainer minWidthClassName="min-w-[680px]" scrollLabel="Открытые жалобы, прокручивается по горизонтали">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Повод</th>
                  <th className="px-4 py-3">Причина</th>
                  <th className="px-4 py-3">Бизнес / Клиент</th>
                  <th className="px-4 py-3">Когда</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {dashboard.openComplaints.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50/60">
                    <td className="px-4 py-3">
                      <ThreadNumber value={c.threadNumber} />
                    </td>
                    <td className="px-4 py-3 text-stone-700">{c.reason}</td>
                    <td className="px-4 py-3 text-stone-700">
                      {c.businessName} / {c.customerName}
                    </td>
                    <td className="px-4 py-3 text-stone-500">{new Date(c.createdAt).toLocaleString("ru-RU")}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`${DIALOGS_PATH}/${c.threadId}`}
                        className="text-sm font-medium text-stone-900 underline underline-offset-2"
                      >
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))}
                {dashboard.openComplaints.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                      Открытых жалоб нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </TableContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
