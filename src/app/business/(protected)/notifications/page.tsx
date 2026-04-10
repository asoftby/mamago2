import { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

export const metadata: Metadata = {
  title: "Уведомления | Business",
};

/** Старый URL — уведомления только из шапки (NotificationsModal). */
export default async function BusinessNotificationsLegacyPage() {
  const routing = await getCurrentRequestRoutingContext();

  redirect(
    buildSurfaceRedirectDestination({
      targetSurface: "business",
      targetPath: "/",
      ...routing,
    }),
  );
}
