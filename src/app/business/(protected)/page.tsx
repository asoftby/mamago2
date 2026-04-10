import { redirect } from "next/navigation";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

/**
 * Root business route - redirects to dashboard
 */
export default async function BusinessRootPage() {
  const routing = await getCurrentRequestRoutingContext();

  redirect(
    buildSurfaceRedirectDestination({
      targetSurface: "business",
      targetPath: "/dashboard",
      ...routing,
    }),
  );
}
