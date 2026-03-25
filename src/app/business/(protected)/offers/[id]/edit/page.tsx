/**
 * Legacy URL — edit flow lives in the isolated content editor.
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";

interface EditOfferPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EditOfferPage({ params, searchParams }: EditOfferPageProps) {
  const user = await getCurrentUser();

  if (!user || !canCreateBusinessContent(user.role)) {
    redirect("/business/login");
  }

  const { id } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.returnTo && typeof sp.returnTo === "string") {
    qs.set("returnTo", sp.returnTo);
  }
  const q = qs.toString();
  redirect(`/editor/offer/${id}/edit${q ? `?${q}` : ""}`);
}
