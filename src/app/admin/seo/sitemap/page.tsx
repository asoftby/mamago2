import { redirect } from "next/navigation";
import { buildAdminPath } from "@/lib/routing/surface";

/** Legacy path → Настройки SEO → Индексация */
export default function LegacySeoSitemapRedirect() {
  redirect(buildAdminPath("/seo/settings/indexation"));
}
