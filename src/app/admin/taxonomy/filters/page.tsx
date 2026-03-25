import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_FILTER_CATALOGS } from "@/lib/taxonomy/adminFilterCatalogs";
export default function AdminFiltersHubPage() {
  return (
    <div className="p-6 md:p-4 space-y-6">
      <div>
        <h1 className="text-2xl md:text-xl font-bold text-gray-900">Фильтры</h1>
        <p className="text-sm text-gray-600 mt-1 max-w-2xl">
          Справочники пользовательских фильтров (отдельно от сигналов discovery и ranking). Выберите
          раздел для настройки.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ADMIN_FILTER_CATALOGS.map((item) =>
          item.implemented ? (
            <Link key={item.id} href={item.href}>
              <Card className="h-full transition-shadow hover:shadow-md hover:border-gray-300">
                <CardHeader>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription className="text-sm">{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-xs font-medium text-blue-600">Открыть →</span>
                </CardContent>
              </Card>
            </Link>
          ) : (
            <Card key={item.id} className="h-full opacity-55">
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription className="text-sm">{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-xs font-medium text-gray-400">Скоро</span>
              </CardContent>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}
