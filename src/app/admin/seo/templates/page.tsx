import { redirect } from "next/navigation";
import { buildAdminPath } from "@/lib/routing/surface";

/**
 * Templates UI was session/mock with empty getSeoTemplates().
 * Route kept so bookmarks don't 404; product nav no longer links here.
 */
export default function LegacySeoTemplatesRedirect() {
  redirect(buildAdminPath("/seo"));
}
