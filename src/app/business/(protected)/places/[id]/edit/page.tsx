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
  
  // Add returnTo parameter to redirect back to business places list
  const returnTo = typeof sp.returnTo === "string" 
    ? sp.returnTo 
    : "/business/places";
  
  redirect(`/editor/place/${id}/edit?returnTo=${encodeURIComponent(returnTo)}`);
}
