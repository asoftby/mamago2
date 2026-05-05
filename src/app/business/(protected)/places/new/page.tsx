/**
 * Legacy URL — create flow lives in the isolated content editor.
 */

import { redirect } from "next/navigation";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

export default async function NewPlacePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const routing = await getCurrentRequestRoutingContext();
  const sp = await searchParams;

  // Build base redirect URL
  const baseUrl = buildSurfaceRedirectDestination({
    targetSurface: "public",
    targetPath: "/editor/place/new",
    ...routing,
  });

  // Add returnTo parameter to redirect back to business places list
  const returnTo = typeof sp.returnTo === "string" 
    ? sp.returnTo 
    : "/business/places";
  
  const url = new URL(baseUrl, "http://localhost");
  url.searchParams.set("returnTo", returnTo);
  
  redirect(url.pathname + url.search);
}
