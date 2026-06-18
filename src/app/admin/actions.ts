"use server";

import { getRevenueSnapshot } from "@/lib/admin/dashboardData";
import type { RevenueSnapshot } from "@/lib/admin/dashboardData";

export async function fetchRevenueSnapshot(
  from: string,
  to: string,
): Promise<RevenueSnapshot> {
  return getRevenueSnapshot(new Date(from), new Date(to));
}
