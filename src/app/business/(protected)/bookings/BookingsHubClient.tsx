"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { BookingsPageClient } from "./BookingsPageClient";
import { PartyRequestsPanel } from "./PartyRequestsPanel";

export function BookingsHubClient() {
  const search = useSearchParams();
  const [tab, setTab] = useState<"standard" | "parties">(
    search.get("tab") === "parties" ? "parties" : "standard",
  );
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-4">
      <button type="button" aria-pressed={tab === "standard"} onClick={() => setTab("standard")}
        className={"rounded-xl px-4 py-2.5 text-sm font-semibold " +
          (tab === "standard" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700")}>
        Записи и заказы
      </button>
      <button type="button" aria-pressed={tab === "parties"} onClick={() => setTab("parties")}
        className={"rounded-xl px-4 py-2.5 text-sm font-semibold " +
          (tab === "parties" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700")}>
        Праздники
      </button>
    </div>
    {tab === "parties" ? <PartyRequestsPanel /> : <BookingsPageClient />}
  </div>;
}
