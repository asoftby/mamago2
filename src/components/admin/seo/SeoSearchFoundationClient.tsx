"use client";

import { LineChart, ListOrdered, FileSearch } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeoPageHeader } from "@/components/admin/seo/primitives/SeoPageHeader";
import { SeoEmptyState } from "@/components/admin/seo/primitives/SeoEmptyState";

interface SeoSearchFoundationClientProps {
  breadcrumb: string;
}

export function SeoSearchFoundationClient({
  breadcrumb,
}: SeoSearchFoundationClientProps) {
  return (
    <div className="space-y-8">
      <SeoPageHeader
        title="Поиск"
        subtitle={`Поисковый спрос и результаты для контекста: ${breadcrumb}`}
      />

      <Tabs defaultValue="queries" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="queries">Запросы</TabsTrigger>
          <TabsTrigger value="pages">Страницы</TabsTrigger>
          <TabsTrigger value="trends">Динамика</TabsTrigger>
        </TabsList>

        <TabsContent value="queries">
          <SeoEmptyState
            icon={<ListOrdered className="h-6 w-6 text-gray-400" />}
            title="Источник данных не подключён"
            description="Запросы из Google Search Console, Яндекс.Вебмастера и Wordstat будут привязаны к текущему SEO-контексту (город / регион / страна). Один запрос может иметь разную частотность и позицию в разных гео."
          />
        </TabsContent>

        <TabsContent value="pages">
          <SeoEmptyState
            icon={<FileSearch className="h-6 w-6 text-gray-400" />}
            title="Источник данных не подключён"
            description="Здесь появятся посадочные страницы с кликами и показами в рамках выбран географического контекста."
          />
        </TabsContent>

        <TabsContent value="trends">
          <SeoEmptyState
            icon={<LineChart className="h-6 w-6 text-gray-400" />}
            title="Источник данных не подключён"
            description="Динамика спроса и позиций будет доступна после подключения внешних поисковых источников."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
