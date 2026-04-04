/** Query param: open My Plan after login/register redirect. */
export const MY_PLAN_OPEN_QUERY = "myPlan";
export const MY_PLAN_OPEN_VALUE = "open";
export const MY_PLAN_OPEN_EVENT = "my-plan-open-request";

export function appendMyPlanOpenToHref(href: string): string {
  if (!href || typeof href !== "string") return href;
  try {
    const u = new URL(href, typeof window !== "undefined" ? window.location.origin : "https://example.com");
    u.searchParams.set(MY_PLAN_OPEN_QUERY, MY_PLAN_OPEN_VALUE);
    if (href.startsWith("/")) return u.pathname + u.search + u.hash;
    return u.toString();
  } catch {
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}${MY_PLAN_OPEN_QUERY}=${MY_PLAN_OPEN_VALUE}`;
  }
}

export function requestOpenMyPlan() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MY_PLAN_OPEN_EVENT));
}
