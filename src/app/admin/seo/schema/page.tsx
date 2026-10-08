import { redirect } from "next/navigation";
import { buildAdminPath } from "@/lib/routing/surface";

/** Legacy path → Настройки SEO → Структурированные данные */
export default function LegacySeoSchemaRedirect() {
  redirect(buildAdminPath("/seo/settings/schema"));
}
