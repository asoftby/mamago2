/**
 * Legacy URL — edit flow lives in the isolated content editor.
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

interface EditOfferPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EditOfferPage({ params, searchParams }: EditOfferPageProps) {
  const routing = await getCurrentRequestRoutingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
        ...routing,
      }),
    );
  }

  const { id } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  const returnTo = typeof sp.returnTo === "string"
    ? sp.returnTo
    : "/business/offers";
  qs.set("returnTo", returnTo);

  const q = qs.toString();
  redirect(
    buildSurfaceRedirectDestination({
      targetSurface: "public",
      targetPath: `/editor/offer/${id}/edit${q ? `?${q}` : ""}`,
      ...routing,
    }),
  );
}