"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalyticsOverviewFilters } from "@/lib/analytics/adminOverviewTypes";
import { cn } from "@/lib/utils";
import { AdminAnalyticsAudienceSegments } from "./AdminAnalyticsAudienceSegments";
import { AdminAnalyticsBehavior } from "./AdminAnalyticsBehavior";
import { AdminAnalyticsContentPerformance } from "./AdminAnalyticsContentPerformance";
import { AdminAnalyticsFunnels } from "./AdminAnalyticsFunnels";
import { AdminAnalyticsOverview } from "./AdminAnalyticsOverview";

const TAB_TRIGGER_CLASS =
  "text-xs sm:text-sm px-2.5 sm:px-3 data-[state=active]:text-foreground";

type AdminAnalyticsTabsProps = {
  analyticsFilters: AnalyticsOverviewFilters;
};

/**
 * Вкладки раздела Analytics (Overview / Audience — агрегаты).
 */
export function AdminAnalyticsTabs({ analyticsFilters }: AdminAnalyticsTabsProps) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList
        className={cn(
          "flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 rounded-xl bg-muted/80 p-1.5 text-muted-foreground",
        )}
      >
        <TabsTrigger value="overview" className={TAB_TRIGGER_CLASS}>
          Overview
        </TabsTrigger>
        <TabsTrigger value="audience" className={TAB_TRIGGER_CLASS}>
          Audience Segments
        </TabsTrigger>
        <TabsTrigger value="behavior" className={TAB_TRIGGER_CLASS}>
          Behavior
        </TabsTrigger>
        <TabsTrigger value="content" className={TAB_TRIGGER_CLASS}>
          Content Performance
        </TabsTrigger>
        <TabsTrigger value="funnels" className={TAB_TRIGGER_CLASS}>
          Funnels
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6 focus-visible:outline-none">
        <AdminAnalyticsOverview filters={analyticsFilters} />
      </TabsContent>

      <TabsContent value="audience" className="mt-6 focus-visible:outline-none">
        <AdminAnalyticsAudienceSegments filters={analyticsFilters} />
      </TabsContent>

      <TabsContent value="behavior" className="mt-6 focus-visible:outline-none">
        <AdminAnalyticsBehavior filters={analyticsFilters} />
      </TabsContent>

      <TabsContent value="content" className="mt-6 focus-visible:outline-none">
        <AdminAnalyticsContentPerformance filters={analyticsFilters} />
      </TabsContent>

      <TabsContent value="funnels" className="mt-6 focus-visible:outline-none">
        <AdminAnalyticsFunnels filters={analyticsFilters} />
      </TabsContent>
    </Tabs>
  );
}
