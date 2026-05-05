import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  TrendingUp,
  Users,
  AlertCircle,
  Image,
  Tag,
  Copy,
} from "lucide-react";
import {
  getActionCenterData,
  getRevenueSnapshot,
  getMoneyRadarData,
  getNeedsAttentionData,
  getContentQueuesData,
  getContentQualityData,
  getRecentActivityData,
} from "@/lib/admin/dashboardData";
import { cn } from "@/lib/utils";

function FinanceStatCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  sublabel,
}: {
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  label: string;
  value: ReactNode;
  sublabel?: string;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-3 sm:p-4">
      <div className="mb-2 flex min-w-0 items-start gap-2">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClassName)} />
        <p className="min-w-0 break-words text-sm leading-snug text-gray-600">{label}</p>
      </div>
      <p className="min-w-0 break-words text-base font-bold tabular-nums leading-tight text-gray-900">
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1 min-w-0 break-words text-xs text-gray-500">{sublabel}</p>
      ) : null}
    </div>
  );
}

// Severity color mapping
const severityColors = {
  low: "bg-gray-100 text-gray-700 border-gray-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const severityIcons = {
  low: AlertCircle,
  medium: Clock,
  high: AlertTriangle,
  critical: AlertTriangle,
};

import { formatPrice } from "@/lib/formatters/format-price";

// Format currency — kept for local use, delegates to shared formatter
function formatCurrency(amount: number): string {
  return formatPrice(amount);
}

export default function AdminDashboardPage() {
  const actionCenter = getActionCenterData();
  const revenue = getRevenueSnapshot();
  const moneyRadar = getMoneyRadarData();
  const needsAttention = getNeedsAttentionData();
  const contentQueues = getContentQueuesData();
  const contentQuality = getContentQualityData();
  const recentActivity = getRecentActivityData();
  console.log("[API] real data used", { endpoint: "admin-dashboard", empty: true });

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">Обзор платформы и операционный контроль</p>
        </div>
      </div>

      {/* 1. Action Center */}
      <section>
        <h2 className="text-lg md:text-base font-semibold text-gray-900 mb-4">Требует действий</h2>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {actionCenter.map((item) => {
            const Icon = severityIcons[item.severity];
            return (
              <Link
                key={item.id}
                href={item.link}
                className={`block p-4 rounded-lg border-2 hover:shadow-md transition-shadow ${severityColors[item.severity]}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">{item.title}</p>
                    <p className="text-base font-bold">{item.count}</p>
                  </div>
                  <Icon className="w-5 h-5 flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 2. Revenue Snapshot */}
      <section>
        <h2 className="text-lg md:text-base font-semibold text-gray-900 mb-4">Финансы</h2>
        <div className="grid min-w-0 grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <FinanceStatCard
            icon={DollarSign}
            iconClassName="text-green-600"
            label="Выручка сегодня"
            value={formatCurrency(revenue.revenueToday)}
          />
          <FinanceStatCard
            icon={TrendingUp}
            iconClassName="text-blue-600"
            label="MRR"
            value={formatCurrency(revenue.mrr)}
          />
          <FinanceStatCard
            icon={TrendingUp}
            iconClassName="text-purple-600"
            label="Буст"
            value={formatCurrency(revenue.boostRevenue30d)}
            sublabel="За 30 дней"
          />
          <FinanceStatCard
            icon={CheckCircle}
            iconClassName="text-green-600"
            label="Новые подписки"
            value={revenue.newSubscriptions30d}
            sublabel="За 30 дней"
          />
          <FinanceStatCard
            icon={Users}
            iconClassName="text-blue-600"
            label="Лиды"
            value={revenue.leadsGenerated30d}
            sublabel="За 30 дней"
          />
        </div>
      </section>

      {/* 3. Money Radar */}
      <section>
        <h2 className="text-lg md:text-base font-semibold text-gray-900 mb-4">Возможности монетизации</h2>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {moneyRadar.map((item) => (
            <Link
              key={item.id}
              href={item.link}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col gap-1.5 mb-2">
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <span className="w-fit text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">
                  {formatCurrency(item.potential)}
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-3">{item.description}</p>
              <p className="text-base font-bold text-gray-900">{item.count}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Needs Attention + 5. Content Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs Attention */}
        <section>
          <h2 className="text-lg md:text-base font-semibold text-gray-900 mb-4">Требует внимания</h2>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
            {needsAttention.slice(0, 5).map((item) => {
              const Icon = severityIcons[item.severity];
              return (
                <Link
                  key={item.id}
                  href={item.link}
                  className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-3"
                >
                  <div className={`p-2 rounded-lg ${severityColors[item.severity]}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{item.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Content Queues */}
        <section>
          <h2 className="text-lg md:text-base font-semibold text-gray-900 mb-4">Очереди модерации</h2>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
            {contentQueues.map((item) => (
              <Link
                key={item.id}
                href={item.link}
                className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">{item.label}</span>
                </div>
                <span className="text-base font-bold text-gray-900">{item.count}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* 6. Content Quality */}
      <section>
        <h2 className="text-lg md:text-base font-semibold text-gray-900 mb-4">Качество контента</h2>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {contentQuality.map((item) => {
            const icons = {
              no_cover: Image,
              no_seo: Tag,
              no_taxonomy: Tag,
              duplicates: Copy,
            };
            const Icon = icons[item.link.split("=")[1] as keyof typeof icons] || AlertCircle;
            
            return (
              <Link
                key={item.id}
                href={item.link}
                className={`p-4 rounded-lg border hover:shadow-md transition-shadow ${
                  item.severity === "high"
                    ? "bg-orange-50 border-orange-200"
                    : item.severity === "medium"
                    ? "bg-yellow-50 border-yellow-200"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <Icon className="w-5 h-5 text-gray-600" />
                  <span className="text-base font-bold text-gray-900">{item.count}</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 7. Recent Activity */}
      <section>
        <h2 className="text-lg md:text-base font-semibold text-gray-900 mb-4">Последняя активность</h2>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {recentActivity.map((item) => {
            const typeColors = {
              approval: "bg-green-100 text-green-700",
              creation: "bg-blue-100 text-blue-700",
              edit: "bg-yellow-100 text-yellow-700",
              request: "bg-purple-100 text-purple-700",
            };

            return (
              <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                {item.link ? (
                  <Link href={item.link} className="flex items-start gap-3">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${typeColors[item.type]}`}>
                      {item.type === "approval" && "Одобрено"}
                      {item.type === "creation" && "Создано"}
                      {item.type === "edit" && "Изменено"}
                      {item.type === "request" && "Запрос"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{item.actor}</span> {item.action}{" "}
                        <span className="font-medium">{item.entity}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDistanceToNow(item.timestamp, { addSuffix: true, locale: ru })}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${typeColors[item.type]}`}>
                      {item.type === "approval" && "Одобрено"}
                      {item.type === "creation" && "Создано"}
                      {item.type === "edit" && "Изменено"}
                      {item.type === "request" && "Запрос"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{item.actor}</span> {item.action}{" "}
                        <span className="font-medium">{item.entity}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDistanceToNow(item.timestamp, { addSuffix: true, locale: ru })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
