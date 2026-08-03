import { redirect } from "next/navigation";

/** Legacy/articles list URL — editorial list lives under publications. */
export default function AdminContentArticlesIndexPage() {
  redirect("/admin/content/publications");
}
