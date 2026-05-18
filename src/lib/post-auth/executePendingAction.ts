import type { PendingPostAuthAction } from "./types";

/**
 * Выполняет отложенное сохранение сразу после auth (до completion flow).
 */
export async function executePendingPostAuthAction(
  action: PendingPostAuthAction,
): Promise<void> {
  if (!action) return;

  if (action.kind === "save_idea") {
    if (action.entityType === "activity") {
      const res = await fetch("/api/save/idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          activityId: action.entityId,
        }),
      });
      if (!res.ok) throw new Error("idea_save_failed");
      return;
    }
    
    if (action.entityType === "route") {
      const res = await fetch("/api/ideas/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          routeId: action.entityId,
          routeSlug: action.routeSlug,
        }),
      });
      if (!res.ok) throw new Error("route_idea_save_failed");
      return;
    }
  }

  if (action.kind === "save_plan") {
    if (action.entityType === "activity") {
      const res = await fetch("/api/save/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          activityId: action.entityId,
          date: action.plannedDate,
          title: action.title,
          coverImageUrl: action.coverImageUrl,
        }),
      });
      if (!res.ok) throw new Error("plan_save_failed");
      return;
    }

    if (action.entityType === "route") {
      const res = await fetch("/api/plan/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          routeId: action.entityId,
          routeSlug: action.routeSlug,
          date: action.plannedDate,
          title: action.title,
          coverImageUrl: action.coverImageUrl,
        }),
      });
      if (!res.ok) throw new Error("route_plan_save_failed");
      return;
    }
  }
}
