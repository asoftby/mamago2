"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DiscoveryTaxonomyPageShell } from "@/components/admin/discovery";
import { SectionsTab } from "./_components/SectionsTab";
import { CategoriesTab } from "./_components/CategoriesTab";
import { DirectoryTab } from "./_components/DirectoryTab";

export default function FiltersPage() {
  return (
    <DiscoveryTaxonomyPageShell>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-gray-900">Фильтры подбора</h1>
        <p className="text-sm text-gray-500 max-w-2xl">
          Настройте фильтры, которые пользователь видит в разделах и категориях каталога.
          Фильтры управляют интерфейсом подбора и не являются бизнес-данными.
        </p>
      </div>

      <Tabs defaultValue="sections">
        <TabsList>
          <TabsTrigger value="sections">Разделы</TabsTrigger>
          <TabsTrigger value="categories">Категории</TabsTrigger>
          <TabsTrigger value="directory">Справочник фильтров</TabsTrigger>
        </TabsList>

        <TabsContent value="sections" className="mt-6">
          <SectionsTab />
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <CategoriesTab />
        </TabsContent>

        <TabsContent value="directory" className="mt-6">
          <DirectoryTab />
        </TabsContent>
      </Tabs>
    </DiscoveryTaxonomyPageShell>
  );
}
