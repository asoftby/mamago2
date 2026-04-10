/**
 * Legacy URL — create flow lives in the isolated content editor.
 */

import { redirect } from "next/navigation";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

export default async function NewPlacePage() {
  const routing = await getCurrentRequestRoutingContext();

  redirect(
    buildSurfaceRedirectDestination({
      targetSurface: "public",
      targetPath: "/editor/place/new",
      ...routing,
    }),
  );
}
