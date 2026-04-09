import { redirect } from "next/navigation";

/** @deprecated Используйте `/admin/content/places/[id]` */
export default async function LegacyModerationPlaceDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(sp).filter(([, v]) => v != null) as [string, string][]),
  ).toString();
  redirect(`/admin/content/places/${id}${q ? `?${q}` : ""}`);
}
