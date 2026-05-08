import { redirect } from "next/navigation";
import { BUSINESS_BILLING_BALANCE_HREF } from "@/lib/business/navigation";

// Redirect old /deposit route to new /billing (Balance tab)
export default function DepositRedirectPage() {
  redirect(BUSINESS_BILLING_BALANCE_HREF);
}
