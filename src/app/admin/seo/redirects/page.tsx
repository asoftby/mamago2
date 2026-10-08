import { redirect } from "next/navigation";
import { buildAdminPath } from "@/lib/routing/surface";

/** Legacy path → Настройки SEO → Редиректы */
export default function LegacySeoRedirectsRedirect() {
  redirect(buildAdminPath("/seo/settings/redirects"));
}
