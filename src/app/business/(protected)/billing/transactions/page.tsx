import { redirect } from "next/navigation";
import { BUSINESS_BILLING_HISTORY_HREF } from "@/lib/business/navigation";

// Redirect old /transactions route to new /history
export default function TransactionsRedirectPage() {
  redirect(BUSINESS_BILLING_HISTORY_HREF);
}
