import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/server";
import { getProfileDestination } from "@/lib/routing/profileRedirect";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";

export default async function ProfileEntryPage() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? undefined;
  const protocol = headerStore.get("x-forwarded-proto") ?? undefined;
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
        currentHost: host,
        currentProtocol: protocol,
      }),
    );
  }

  // Always redirect to the unified profile page
  redirect(
    getProfileDestination({
      host,
      protocol,
      role: user.role,
    }),
  );
}
