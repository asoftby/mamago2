import { permanentRedirect } from "next/navigation";

/**
 * Совместимость: старый публичный путь `/{city}/activity/{slug|id}` → 301 на `/{city}/events/{slug|id}`.
 * Кабинеты и админка по-прежнему используют id в своих маршрутах (`/me/...`, `/admin/...`, `/business/...`).
 */
function searchParamsToSuffix(
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

export default async function LegacyActivityPublicRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ city: string; slugOrId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { city, slugOrId } = await params;
  const sp = (await searchParams) ?? {};
  permanentRedirect(`/${city}/events/${slugOrId}${searchParamsToSuffix(sp)}`);
}
