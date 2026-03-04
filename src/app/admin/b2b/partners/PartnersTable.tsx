'use client';

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type Business = {
  id: string;
  name: string;
  unp: string | null;
  verificationStatus: string;
  updatedAt: Date;
  owner: {
    email: string;
    phoneE164: string | null;
  };
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
      business.owner.email.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Поиск по названию, УНП, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-600">
        Найдено: {filteredBusinesses.length} из {businesses.length}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Название
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                УНП
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email владельца
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Телефон
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Обновлено
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredBusinesses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {searchQuery
                    ? "Ничего не найдено"
                    : "Нет верифицированных бизнесов"}
                </td>
              </tr>
            ) : (
              filteredBusinesses.map((business) => (
                <tr key={business.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {business.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {business.unp || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {business.owner.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {business.owner.phoneE164 || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(business.updatedAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <Link href={`/admin/b2b/partners/${business.id}`}>
                      <Button variant="outline" size="sm">
                        Открыть
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
