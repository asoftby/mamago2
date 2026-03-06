"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function PlacesFilters({ cities }: { cities: { id: string; name: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/admin/moderation/places?${params.toString()}`);
  };

  return (
    <div className="mb-6 flex gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          value={searchParams.get("status") || ""}
          onChange={(e) => handleFilterChange("status", e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Черновик</option>
          <option value="PENDING">На модерации</option>
          <option value="PUBLISHED">Опубликовано</option>
          <option value="NEEDS_CHANGES">Требует правок</option>
          <option value="REJECTED">Отклонено</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          City
        </label>
        <select
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          value={searchParams.get("cityId") || ""}
          onChange={(e) => handleFilterChange("cityId", e.target.value)}
        >
          <option value="">All cities</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
