/**
 * Legacy URL — create flow lives in the isolated content editor.
 */

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";

export const metadata = {
  title: "Новое событие | MamaGo Business",
  description: "Создание нового события",
};

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();

  if (!user || !canCreateBusinessContent(user.role)) {
    redirect("/business/login");
  }

  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.returnTo && typeof sp.returnTo === "string") {
    qs.set("returnTo", sp.returnTo);
  }
  const q = qs.toString();
  redirect(`/editor/event/new${q ? `?${q}` : ""}`);
}
