import Link from "next/link";
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
} from "@/lib/admin/mockDashboardData";

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

// Format currency
function formatCurrency(amount: number, currency: string = "BYN"): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function AdminDashboardPage() {
  const actionCenter = getActionCenterData();
  const revenue = getRevenueSnapshot();
  const moneyRadar = getMoneyRadarData();
  const needsAttention = getNeedsAttentionData();
  const contentQueues = getContentQueuesData();
  const contentQuality = getContentQualityData();
  const recentActivity = getRecentActivityData();

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
                    <p className="text-2xl font-bold">{item.count}</p>
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <p className="text-sm text-gray-600">Выручка сегодня</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenue.revenueToday)}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-gray-600">MRR</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenue.mrr)}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <p className="text-sm text-gray-600">Буст (30 дней)</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(revenue.boostRevenue30d)}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-sm text-gray-600">Новые подписки</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{revenue.newSubscriptions30d}</p>
            <p className="text-xs text-gray-500 mt-1">За 30 дней</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-600" />
              <p className="text-sm text-gray-600">Лиды</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{revenue.leadsGenerated30d}</p>
            <p className="text-xs text-gray-500 mt-1">За 30 дней</p>
          </div>
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
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">
                  {formatCurrency(item.potential)}
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-3">{item.description}</p>
              <p className="text-2xl font-bold text-gray-900">{item.count}</p>
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
                <span className="text-lg font-bold text-gray-900">{item.count}</span>
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
                  <span className="text-2xl font-bold text-gray-900">{item.count}</span>
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
