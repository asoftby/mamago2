import { redirect } from "next/navigation";

export default async function LegacyHomeStoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") params.set(key, value);
  }
  const suffix = params.size ? `?${params.toString()}` : "";
  redirect(`/admin/ranking/stories-intents${suffix}`);
}
