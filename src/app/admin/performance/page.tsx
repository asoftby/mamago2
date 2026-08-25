import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PerformancePeriodSelector } from "@/components/admin/performance/PerformancePeriodSelector";
import { parsePerformancePeriod } from "@/lib/performance/performanceMetrics";
import { getPerformanceDashboard } from "@/server/services/performance/performanceDashboard.service";

function formatValue(value: number | null, suffix = "") { return value == null ? "—" : `${value.toLocaleString("ru-RU")}${suffix}`; }
function Trend({ value }: { value: number | null }) {
  return <span className="text-xs text-gray-500">{value == null ? "Нет базы сравнения" : `${value > 0 ? "+" : ""}${value}% к прошлому периоду`}</span>;
}
function Card({ label, value, note, trend }: { label: string; value: string | number; note?: string; trend?: number | null }) {
  return <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-gray-600">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-gray-950">{value}</p>{trend !== undefined ? <Trend value={trend} /> : note ? <p className="mt-1 text-xs text-gray-500">{note}</p> : null}</div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3"><h2 className="text-base font-semibold text-gray-950">{title}</h2>{children}</section>;
}
export default async function AdminPerformancePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const params = await searchParams;
  const period = parsePerformancePeriod(params.period);
  const data = await getPerformanceDashboard(period);
  return (
    <div className="min-w-0 space-y-7 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <AdminPageHeader title="Performance" subtitle="Ключевые показатели здоровья mamaGo" backHref="/admin" />
        <PerformancePeriodSelector value={period} />
      </div>
      <p className="text-xs text-gray-500">Фактические данные · Europe/Minsk · {new Date(data.range.start).toLocaleString("ru-RU", { timeZone: data.range.timeZone })} — сейчас</p>

      <Section title="Аудитория">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label="DAU" value={data.audience.dau} note="Активные авторизованные пользователи сегодня" />
          <Card label="WAU" value={data.audience.wau} note="Активные авторизованные пользователи за 7 дней" />
          <Card label="MAU" value={data.audience.mau} note="Активные авторизованные пользователи за 30 дней" />
          <Card label="WAU / MAU" value={formatValue(data.audience.stickiness, "%")} note="Stickiness авторизованной аудитории" />
          <Card label="Tracked sessions" value={data.audience.trackedVisitors} trend={data.audience.trackedVisitorsTrend} />
          <Card label="Новые аккаунты" value={data.audience.newAccounts} trend={data.audience.newAccountsTrend} />
          <Card label="Returning users" value={data.audience.returningUsers} note="Были активны и до выбранного периода" />
          <Card label="Registration conversion" value="—" note="Нет надёжной registration-source attribution" />
        </div>
      </Section>

      <Section title="Engagement">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Card label="Показы карточек" value={data.engagement.views} trend={data.engagement.viewsTrend} />
          <Card label="Открытия контента" value={data.engagement.opens} />
          <Card label="Сохранения" value={data.engagement.saves} />
          <Card label="Добавления в план" value={data.engagement.planAdds} />
          <Card label="CTA клики" value={data.engagement.ctaClicks} />
        </div>
      </Section>

      <Section title="Discovery и контент">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label="Поиски" value={data.discovery.searches} trend={data.discovery.searchesTrend} />
          <Card label="Tracked searchers" value={data.discovery.uniqueTrackedSearchers} />
          <Card label="Поиски без результатов" value={data.discovery.zeroSearches} />
          <Card label="Zero-result rate" value={formatValue(data.discovery.zeroSearchRate, "%")} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold">Контент с взаимодействиями</h3>
            {data.topContent.length ? <ol className="mt-3 space-y-2">{data.topContent.map((item) => <li key={`${item.entityType}:${item.entityId}`} className="flex min-w-0 justify-between gap-3 text-sm"><span className="truncate">{item.title}</span><span className="shrink-0 font-semibold tabular-nums">{item.interactions}</span></li>)}</ol> : <p className="mt-3 text-sm text-gray-500">Нет взаимодействий за период</p>}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold">Marketplace snapshot</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">{Object.entries({ "Published Events": data.inventory.publishedEvents, "Published Places": data.inventory.publishedPlaces, "Published Offers": data.inventory.publishedOffers, "Active businesses": data.inventory.activeBusinesses, "Создано Routes": data.inventory.createdRoutes }).map(([label, value]) => <div key={label}><dt className="text-gray-500">{label}</dt><dd className="text-lg font-bold tabular-nums">{value}</dd></div>)}</dl>
          </div>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4"><h2 className="text-base font-semibold">Retention</h2><p className="mt-2 text-sm text-gray-600">Недостаточно данных: история телеметрии короткая и не содержит надёжной acquisition cohort для D1/D7/D30.</p></div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4"><h2 className="text-base font-semibold">Монетизация</h2><p className="mt-2 text-sm text-gray-600">Денежные KPI недоступны до проверки ledger и balance architecture в Task 13.</p></div>
      </div>
    </div>
  );
}
