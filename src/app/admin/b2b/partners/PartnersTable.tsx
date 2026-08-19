'use client';

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { TableContainer } from "@/components/ui/table";
import {
  DataCardList,
  DataCard,
  DataCardHeader,
  DataCardBody,
  DataCardRow,
  DataCardActions,
} from "@/components/ui/data-card-list";

type Business = {
  id: string;
  name: string;
  unp: string | null;
  verificationStatus: string;
  updatedAt: Date;
  owner: {
    email: string;
    phoneE164: string | null;
  } | null;
};

interface PartnersTableProps {
  businesses: Business[];
}

export function PartnersTable({ businesses }: PartnersTableProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Client-side filtering
  const filteredBusinesses = businesses.filter((business) => {
    const query = searchQuery.toLowerCase();
    return (
      business.name.toLowerCase().includes(query) ||
      (business.unp && business.unp.includes(query)) ||
      (business.owner?.email.toLowerCase().includes(query) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      {/* AdminPageToolbar */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Поиск по названию, УНП, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-gray-600">
          Найдено: {filteredBusinesses.length} из {businesses.length}
        </div>
      </div>

      {/* Table — desktop */}
      <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
        <TableContainer minWidthClassName="min-w-[760px]" scrollLabel="Список партнёров, прокручивается по горизонтали">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Название
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  УНП
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Email владельца
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Телефон
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  Обновлено
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBusinesses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-600">
                    {searchQuery
                      ? "Ничего не найдено"
                      : "Нет верифицированных бизнесов"}
                  </td>
                </tr>
              ) : (
                filteredBusinesses.map((business) => (
                  <tr key={business.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {business.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {business.unp || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {business.owner?.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {business.owner?.phoneE164 || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(business.updatedAt).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/b2b/partners/${business.id}`}>
                        <Button variant="outline" size="sm" className="h-8">
                          Открыть
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableContainer>
      </div>

      {/* Cards — mobile */}
      {filteredBusinesses.length === 0 ? (
        <div className="md:hidden rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-600">
          {searchQuery ? "Ничего не найдено" : "Нет верифицированных бизнесов"}
        </div>
      ) : (
        <DataCardList>
          {filteredBusinesses.map((business) => (
            <DataCard key={business.id}>
              <DataCardHeader title={business.name} />
              <DataCardBody>
                <DataCardRow label="УНП" value={business.unp} />
                <DataCardRow label="Email владельца" value={business.owner?.email} />
                <DataCardRow label="Телефон" value={business.owner?.phoneE164} />
                <DataCardRow label="Обновлено" value={new Date(business.updatedAt).toLocaleDateString("ru-RU")} />
              </DataCardBody>
              <DataCardActions>
                <Link href={`/admin/b2b/partners/${business.id}`} className="w-full">
                  <Button variant="outline" size="sm" className="w-full">
                    Открыть
                  </Button>
                </Link>
              </DataCardActions>
            </DataCard>
          ))}
        </DataCardList>
      )}
    </div>
  );
}
