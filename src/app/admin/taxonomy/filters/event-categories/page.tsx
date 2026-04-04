import { redirect } from "next/navigation";

/** Старый URL: единая страница категорий с типами публикаций. */
export default function LegacyEventCategoriesRedirect() {
  redirect("/admin/taxonomy/categories");
}
