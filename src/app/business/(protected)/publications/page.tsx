import { redirect } from "next/navigation";
import { businessRoute } from "@/lib/business/navigation";

export default function PublicationsPage() {
  redirect(businessRoute("/publications/events"));
}
