"use client";

import { SearchLayout } from "@/components/admin/search/SearchLayout";
import { Search, TrendingUp, AlertCircle, MousePointerClick } from "lucide-react";

// Mock data
const stats = [
  {
    id: "searches-today",
    label: "Searches Today",
    value: "12,847",
    change: "+12.5%",
    trend: "up" as const,
    icon: Search,
  },
  {
    id: "unique-queries",
    label: "Unique Queries",
    value: "3,421",
    change: "+8.2%",
    trend: "up" as const,
    icon: TrendingUp,
  },
  {
    id: "zero-results",
    label: "Zero-Result Queries",
    value: "247",
    change: "-5.3%",
    trend: "down" as const,
    icon: AlertCircle,
  },
  {
    id: "avg-ctr",
    label: "Average CTR",
    value: "42.8%",
    change: "+3.1%",
    trend: "up" as const,
    icon: MousePointerClick,
  },
];

const popularQueries = [
  { query: "детские мастер-классы", searches: 1247, ctr: 48.2, zeroResults: false },
  { query: "куда пойти с детьми", searches: 1089, ctr: 52.1, zeroResults: false },
  { query: "день рождения ребенка", searches: 892, ctr: 45.7, zeroResults: false },
  { query: "развлечения для детей", searches: 743, ctr: 41.3, zeroResults: false },
  { query: "детские квесты", searches: 621, ctr: 38.9, zeroResults: false },
  { query: "семейные мероприятия", searches: 534, ctr: 44.6, zeroResults: false },
  { query: "детский театр", searches: 487, ctr: 51.2, zeroResults: false },
  { query: "научные шоу", searches: 412, ctr: 39.8, zeroResults: false },
  { query: "аквапарк минск", searches: 389, ctr: 0, zeroResults: true },
  { query: "детские кафе", searches: 356, ctr: 47.3, zeroResults: false },
];

export default function SearchOverviewPage() {
  return (
    <SearchLayout>
      <div className="space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">
                      {stat.label}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {stat.value}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <span
                        className={`text-sm font-medium ${
                          stat.trend === "up"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {stat.change}
                      </span>
                      <span className="text-sm text-gray-500">vs last week</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Popular Queries Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Popular Search Queries
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Most searched queries in the last 7 days
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Query
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Searches
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CTR
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {popularQueries.map((item, index) => (
                  <tr
                    key={index}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Search className="w-4 h-4 text-gray-400 mr-3" />
                        <span className="text-sm font-medium text-gray-900">
                          {item.query}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {item.searches.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-sm font-medium ${
                          item.ctr === 0
                            ? "text-red-600"
                            : item.ctr > 45
                            ? "text-green-600"
                            : "text-gray-900"
                        }`}
                      >
                        {item.ctr > 0 ? `${item.ctr}%` : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.zeroResults ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Zero Results
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-blue-900">
                Search Analytics Foundation
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                This is a mock dashboard showing the structure and UI for the Search section.
                Backend integration and real analytics will be added in the next phase.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SearchLayout>
  );
}
