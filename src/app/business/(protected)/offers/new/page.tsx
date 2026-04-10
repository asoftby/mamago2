/**
 * Legacy URL — create flow lives in the isolated content editor.
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

export default async function NewOfferPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const routing = await getCurrentRequestRoutingContext();
  const user = await getCurrentUser();

  if (!user || !canCreateBusinessContent(user.role)) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
        ...routing,
      }),
    );
  }

  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.returnTo && typeof sp.returnTo === "string") {
    qs.set("returnTo", sp.returnTo);
  }
  if (sp.placeId && typeof sp.placeId === "string") {
    qs.set("placeId", sp.placeId);
  }
  const q = qs.toString();
  redirect(
    buildSurfaceRedirectDestination({
      targetSurface: "public",
      targetPath: `/editor/offer/new${q ? `?${q}` : ""}`,
      ...routing,
    }),
  );
}
