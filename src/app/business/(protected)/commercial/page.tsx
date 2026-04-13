import { redirect } from "next/navigation";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

/**
 * Legacy compatibility route.
 * Commercial semantics are now split into Promotion + Documents.
 */
export default async function BusinessCommercialCompatibilityPage() {
  const routing = await getCurrentRequestRoutingContext();

  redirect(
    buildSurfaceRedirectDestination({
      targetSurface: "business",
      targetPath: "/promotion",
      ...routing,
    }),
  );
}
