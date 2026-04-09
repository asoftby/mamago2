import { redirect } from "next/navigation";

export const metadata = {
  title: "Вход — mamaGo",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(params ?? {})) {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (typeof value === "string" && value.length > 0) {
      qs.set(key, value);
    }
  }

  redirect(qs.size > 0 ? `/login?${qs.toString()}` : "/login");
}
