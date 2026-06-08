import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { readRedirectParam } from "@/lib/auth/redirectTo";
import { buildAuthenticatedAuthRedirectDestination } from "@/lib/auth/requireAuthRedirect";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) {
    const redirectParam = readRedirectParam(params ?? {});
    redirect(await buildAuthenticatedAuthRedirectDestination(redirectParam));
  }

  const qs = new URLSearchParams();
  qs.set("mode", "register");

  for (const [key, rawValue] of Object.entries(params ?? {})) {
    if (key === "mode") continue;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (typeof value === "string" && value.length > 0) {
      qs.set(key, value);
    }
  }

  redirect(`/login?${qs.toString()}`);
}
