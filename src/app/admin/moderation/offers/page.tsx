import { redirect } from "next/navigation";

/** @deprecated Используйте `/admin/content/offers` */
export default async function LegacyModerationOffersRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
    else q.set(k, v);
  }
  const qs = q.toString();
  redirect(`/admin/content/offers${qs ? `?${qs}` : ""}`);
}
