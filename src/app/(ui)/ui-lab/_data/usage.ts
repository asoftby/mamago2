import usageData from './usage.json';

export interface UsageInfo {
  count: number;
  examples: string[];
}

export const usageMap: Record<string, UsageInfo> = usageData.usage;
