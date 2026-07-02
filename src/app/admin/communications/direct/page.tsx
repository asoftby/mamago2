import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminPath } from "@/lib/routing/surface";
import { getDirectOverviewStats } from "@/server/services/direct/directAdmin.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClasses =
    tone === "danger"
      ? "bg-red-50 text-red-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : "bg-stone-50 text-stone-950";

  return (
    <div className={`rounded-2xl px-4 py-4 ${toneClasses}`}>
      <div className="text-xs uppercase tracking-[0.14em] opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint && <p className="mt-1 text-sm opacity-80">{hint}</p>}
    </div>
  );
}

export default async function AdminDirectOverviewPage() {
  const stats = await getDirectOverviewStats();

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-stone-200/90">
        <CardHeader>
          <CardTitle>Ключевые показатели</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Диалогов всего" value={stats.totalDialogs} hint="Уникальных пар бизнес-клиент" />
          <StatCard label="Активных обращений" value={stats.activeThreads} />
          <StatCard label="Новых за 24ч" value={stats.newOccasions24h} />
          <StatCard label="Сообщений за 24ч" value={stats.messages24h} />
          <StatCard label="Заблокировано" value={stats.blockedThreads} tone={stats.blockedThreads > 0 ? "warning" : "default"} />
          <StatCard
            label="Жалоб в ожидании"
            value={stats.pendingComplaints}
            tone={stats.pendingComplaints > 0 ? "danger" : "default"}
          />
          <StatCard label="Скрытых сообщений" value={stats.hiddenMessages} />
          <StatCard
            label="Без ответа бизнеса"
            value={stats.businessesWithoutReply}
            hint="Бизнесов, ожидающих первого ответа"
            tone={stats.businessesWithoutReply > 0 ? "warning" : "default"}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={adminPath("/communications/direct/dialogs?filter=NO_BUSINESS_REPLY")}
          className="rounded-2xl border border-stone-200 px-4 py-4 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
        >
          Посмотреть диалоги без ответа бизнеса →
        </Link>
        <Link
          href={adminPath("/communications/direct/complaints")}
          className="rounded-2xl border border-stone-200 px-4 py-4 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
        >
          Перейти к жалобам в ожидании →
        </Link>
      </div>
    </div>
  );
}
