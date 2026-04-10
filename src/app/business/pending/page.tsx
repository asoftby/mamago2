import { redirect } from "next/navigation";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

/**
 * DEPRECATED ROUTE - Redirects to canonical verification page
 * /business/pending -> /business/verification
 * 
 * This route exists only for backward compatibility.
 * All business verification status display is now at /business/verification
 */
export default async function LegacyPendingPageRedirect() {
  const routing = await getCurrentRequestRoutingContext();

  redirect(
    buildSurfaceRedirectDestination({
      targetSurface: "business",
      targetPath: "/verification",
      ...routing,
    }),
  );
}
