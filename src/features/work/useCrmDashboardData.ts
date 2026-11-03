"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type CrmLead, type LeadList, type WorkItem, type WorkList,
  isOpen, sortByDeadline, uniqueItems,
} from "./workDashboardModel";

interface DashboardData {
  loading: boolean;
  error: string | null;
  leads: CrmLead[];
  todayItems: WorkItem[];
  upcomingItems: WorkItem[];
  totalLeads: number | null;
  activeSales: number | null;
  refresh: () => void;
}

async function readJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { cache: "no-store", signal });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Сервер CRM ещё не подключён. Дождитесь публикации серверной части.");
    }
    if (response.status === 403) {
      throw new Error("У текущей учётной записи нет доступа к данным CRM.");
    }
    throw new Error("Не удалось загрузить CRM. Повторите попытку.");
  }
  return response.json() as Promise<T>;
}

function query(base: string, values: Record<string, string>): string {
  return `${base}?${new URLSearchParams(values)}`;
}

/** CRM is a view of canonical WorkItem / CrmLead APIs from #1077. */
export function useCrmDashboardData(actorId: string): DashboardData {
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leadsResult, setLeadsResult] = useState<LeadList | null>(null);
  const [upcomingResult, setUpcomingResult] = useState<WorkList | null>(null);
  const [todayResult, setTodayResult] = useState<WorkList | null>(null);
  const [overdueResult, setOverdueResult] = useState<WorkList | null>(null);
  const [activeSales, setActiveSales] = useState<number | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    setRefreshToken(value => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const itemsBase = "/api/admin/work/items";
    const own = { assigneeId: actorId, take: "50" };
    const salesCount = (status: "NEW" | "IN_PROGRESS" | "WAITING") =>
      readJson<WorkList>(query(itemsBase, { kind: "SALES", status, take: "1" }), signal);

    void Promise.all([
      readJson<LeadList>("/api/admin/work/leads?take=50", signal),
      // Exclude completed/canceled tasks on the server, BEFORE pagination.
      readJson<WorkList>(query(itemsBase, { ...own, due: "TODAY", openOnly: "true" }), signal),
      readJson<WorkList>(query(itemsBase, { ...own, due: "OVERDUE" }), signal),
      // Query the server for future OPEN tasks before applying pagination.
      readJson<WorkList>(query(itemsBase, { ...own, due: "UPCOMING", take: "4" }), signal),
      salesCount("NEW"), salesCount("IN_PROGRESS"), salesCount("WAITING"),
    ]).then(([leads, today, overdue, upcoming, salesNew, salesInProgress, salesWaiting]) => {
      if (signal.aborted) return;
      if (!Array.isArray(leads.leads) || !Array.isArray(today.items) ||
        !Array.isArray(overdue.items) || !Array.isArray(upcoming.items)) {
        throw new Error("Сервер вернул неполные данные CRM.");
      }
      setLeadsResult(leads);
      setTodayResult(today);
      setOverdueResult(overdue);
      setUpcomingResult(upcoming);
      setActiveSales(salesNew.total + salesInProgress.total + salesWaiting.total);
      setLoading(false);
    }).catch((cause: unknown) => {
      if (signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Ошибка загрузки CRM.");
      setLoading(false);
    });
    return () => controller.abort();
  }, [actorId, refreshToken]);

  const todayItems = useMemo(() => sortByDeadline(
    uniqueItems(todayResult?.items ?? [], overdueResult?.items ?? []).filter(isOpen),
  ), [todayResult, overdueResult]);

  const upcomingItems = useMemo(
    () => sortByDeadline(upcomingResult?.items ?? []).slice(0, 4),
    [upcomingResult],
  );

  return {
    loading, error,
    leads: leadsResult?.leads ?? [],
    todayItems,
    upcomingItems,
    totalLeads: leadsResult?.total ?? null,
    activeSales,
    refresh,
  };
}
