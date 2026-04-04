"use client";

import { useState } from "react";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";
import { AdminAnalyticsFilters } from "./AdminAnalyticsFilters";
import { AdminAnalyticsTabs } from "./AdminAnalyticsTabs";

const DEFAULT_FILTERS: AnalyticsOverviewFilters = {
  dateRange: "30d",
  entity: "all",
  vertical: "all",
  city: "",
  segment: "",
  childAgeBand: "",
};

export function AdminAnalyticsPageContent() {
  const [filters, setFilters] =
    useState<AnalyticsOverviewFilters>(DEFAULT_FILTERS);

  return (
    <div className="space-y-6">
      <AdminAnalyticsFilters value={filters} onChange={setFilters} />
      <AdminAnalyticsTabs analyticsFilters={filters} />
    </div>
  );
}
