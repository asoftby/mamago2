import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";

export default async function BusinessEntryPage() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto");
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

  // User is authenticated - check if business exists
  const business = await getMyBusiness(user.id);
  
  if (business) {
    // Business exists - go to dashboard
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "business",
        targetPath: "/dashboard",
        currentHost: host,
        currentProtocol: protocol,
      }),
    );
  } else {
    // No business - go to onboarding
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "business",
        targetPath: "/onboarding",
        currentHost: host,
        currentProtocol: protocol,
      }),
    );
  }
}
