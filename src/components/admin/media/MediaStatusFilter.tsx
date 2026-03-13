"use client";

import { useRouter, useSearchParams } from "next/navigation";

export type MediaStatusFilterValue = "active" | "archived" | "all";

export function MediaStatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = (searchParams.get("status") as MediaStatusFilterValue) || "active";

  const handleStatusChange = (status: MediaStatusFilterValue) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (status === "active") {
      params.delete("status");
    } else {
      params.set("status", status);
    }

    router.push(`/admin/media?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleStatusChange("active")}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          currentStatus === "active"
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
        }`}
      >
        Активные
      </button>
      <button
        onClick={() => handleStatusChange("archived")}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          currentStatus === "archived"
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
        }`}
      >
        Архивные
      </button>
      <button
        onClick={() => handleStatusChange("all")}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          currentStatus === "all"
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
        }`}
      >
        Все
      </button>
    </div>
  );
}
