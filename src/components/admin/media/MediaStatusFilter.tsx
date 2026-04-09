"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type MediaStatusFilterValue = "active" | "archived" | "all";

export function MediaStatusFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("status");
  const currentStatus: MediaStatusFilterValue =
    raw === "archived" || raw === "all" ? raw : "active";

  const handleStatusChange = (status: string) => {
    const next = status as MediaStatusFilterValue;
    const params = new URLSearchParams(searchParams.toString());

    if (next === "active") {
      params.delete("status");
    } else {
      params.set("status", next);
    }

    router.push(`/admin/media?${params.toString()}`);
  };

  return (
    <Tabs value={currentStatus} onValueChange={handleStatusChange} className="min-w-0 space-y-3">
      <div className="overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]">
        <TabsList className="inline-flex h-auto w-max min-w-0 gap-1 justify-start rounded-xl bg-gray-100/80 p-1 sm:w-full sm:flex-wrap">
          <TabsTrigger value="active" className="rounded-lg shrink-0">
            Активные
          </TabsTrigger>
          <TabsTrigger value="archived" className="rounded-lg shrink-0">
            Архивные
          </TabsTrigger>
          <TabsTrigger value="all" className="rounded-lg shrink-0">
            Все
          </TabsTrigger>
        </TabsList>
      </div>
    </Tabs>
  );
}
