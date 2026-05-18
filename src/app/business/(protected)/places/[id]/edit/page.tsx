/**
 * Legacy URL — edit flow lives in the isolated content editor.
 */

import { redirect } from "next/navigation";

export default async function EditPlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  
  const returnTo = typeof sp.returnTo === "string" ? sp.returnTo : "/business/places";

  const qs = new URLSearchParams();
  qs.set("returnTo", returnTo);
  const stepRaw = sp.step;
  const step = Array.isArray(stepRaw) ? stepRaw[0] : stepRaw;
  if (typeof step === "string" && step.trim()) {
    qs.set("step", step.trim());
  }

  redirect(`/editor/place/${id}/edit?${qs.toString()}`);
}
