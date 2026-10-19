/**
 * Single removal contract for plan entries in both the sheet and full page.
 * Manual entries enforce optimistic concurrency; catalog and forwarded records
 * use the existing plan-delete endpoint.
 */
export type RemovablePlanEntry = {
  id: string;
  source?: string | null;
  updatedAt?: string | Date | null;
};

export function removePlanEntryRequest(item: RemovablePlanEntry): {
  url: string;
  init: RequestInit;
} {
  if (item.source === "MANUAL") {
    return {
      url: `/api/plan/manual/${encodeURIComponent(item.id)}`,
      init: {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: item.updatedAt instanceof Date
            ? item.updatedAt.toISOString()
            : item.updatedAt ?? null,
        }),
      },
    };
  }
  return {
    url: `/api/save/plan?planItemId=${encodeURIComponent(item.id)}`,
    init: { method: "DELETE", credentials: "include" },
  };
}

export async function removePlanEntry(item: RemovablePlanEntry): Promise<Response> {
  const request = removePlanEntryRequest(item);
  return fetch(request.url, request.init);
}
