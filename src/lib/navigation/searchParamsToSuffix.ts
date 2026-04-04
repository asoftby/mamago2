/** Сериализует searchParams в суффикс `?a=1&b=2` для redirect. */
export function searchParamsToSuffix(
  sp: Record<string, string | string[] | undefined> | undefined,
): string {
  if (!sp || typeof sp !== "object") return "";
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => u.append(k, x));
    else u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}
