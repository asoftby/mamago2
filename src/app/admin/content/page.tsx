import { redirect } from "next/navigation";

/** Section index — land on the first Content nav item. */
export default function AdminContentIndexPage() {
  redirect("/admin/content/events");
}
