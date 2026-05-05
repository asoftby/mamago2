export interface ActionCenterItem {
  id: string;
  type: "moderation" | "improvement" | "verification" | "notification";
  title: string;
  count: number;
  link: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface RevenueSnapshot {
  revenueToday: number;
  mrr: number;
  boostRevenue30d: number;
  newSubscriptions30d: number;
  leadsGenerated30d: number;
}

export interface MoneyRadarItem {
  id: string;
  title: string;
  description: string;
  count: number;
  link: string;
  potential: number;
}

export interface NeedsAttentionItem {
  id: string;
  type: "place" | "event" | "improvement" | "business";
  title: string;
  description: string;
  link: string;
  severity: "low" | "medium" | "high";
}

export interface ContentQueueItem {
  id: string;
  label: string;
  count: number;
  link: string;
}

export interface ContentQualityItem {
  id: string;
  label: string;
  count: number;
  link: string;
  severity: "low" | "medium" | "high";
}

export interface RecentActivityItem {
  id: string;
  type: "approval" | "creation" | "edit" | "request";
  actor: string;
  action: string;
  entity: string;
  timestamp: Date;
  link?: string;
}

export function getActionCenterData(): ActionCenterItem[] {
  return [];
}

export function getRevenueSnapshot(): RevenueSnapshot {
  return {
    revenueToday: 0,
    mrr: 0,
    boostRevenue30d: 0,
    newSubscriptions30d: 0,
    leadsGenerated30d: 0,
  };
}

export function getMoneyRadarData(): MoneyRadarItem[] {
  return [];
}

export function getNeedsAttentionData(): NeedsAttentionItem[] {
  return [];
}

export function getContentQueuesData(): ContentQueueItem[] {
  return [];
}

export function getContentQualityData(): ContentQualityItem[] {
  return [];
}

export function getRecentActivityData(): RecentActivityItem[] {
  return [];
}
