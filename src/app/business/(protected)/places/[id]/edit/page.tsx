/**
 * Legacy URL — edit flow lives in the isolated content editor.
 */

import { redirect } from "next/navigation";

export default async function EditPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/editor/place/${id}/edit`);
}
