import { redirect } from "next/navigation";
import { buildAdminPath } from "@/lib/routing/surface";

/** Legacy path → Настройки SEO → AI Search */
export default function LegacySeoLlmsTxtRedirect() {
  redirect(buildAdminPath("/seo/settings/ai-search"));
}
