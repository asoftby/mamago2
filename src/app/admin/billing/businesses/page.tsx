import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getBillingAccounts } from "@/server/services/billing/billingAccount.service";
import { BillingBusinessesClient } from "./BillingBusinessesClient";

export default async function AdminBillingBusinessesPage() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const accounts = await getBillingAccounts();

  // Calculate attention states
  const accountsWithAttention = accounts.map((account) => {
    const balance = account.depositBalance.toNumber();
    const threshold = account.lowBalanceThreshold.toNumber();
    const subscription = account.subscriptions[0];
    
    const attention: string[] = [];
    
    if (account.status === "SUSPENDED") {
      attention.push("suspended");
    }
    if (balance < threshold) {
      attention.push("low_balance");
    }
    if (!subscription) {
      attention.push("no_subscription");
    }
    if (subscription?.status === "PAST_DUE") {
      attention.push("past_due");
    }

    return {
      id: account.id,
      businessId: account.businessId,
      status: account.status,
      depositBalance: balance,
      currency: account.currency,
      lowBalanceThreshold: threshold,
      creditLimit: account.creditLimit.toNumber(),
      business: {
        name: account.business.name,
        owner: account.business.owner ? {
          email: account.business.owner.email,
        } : null,
      },
      subscriptions: account.subscriptions.map(sub => ({
        plan: {
          name: sub.plan.name,
          price: sub.plan.price.toNumber(),
        },
        status: sub.status,
      })),
      _count: {
        transactions: account._count.transactions,
      },
      attention,
    };
  });

  // Sort by attention level (most critical first)
  accountsWithAttention.sort((a, b) => {
    const priorityOrder = ["suspended", "past_due", "low_balance", "no_subscription"];
    const aMaxPriority = Math.min(...a.attention.map(att => priorityOrder.indexOf(att)).filter(i => i >= 0));
    const bMaxPriority = Math.min(...b.attention.map(att => priorityOrder.indexOf(att)).filter(i => i >= 0));
    return aMaxPriority - bMaxPriority;
  });

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* Client Component with all interactive features */}
      <BillingBusinessesClient accounts={accountsWithAttention} />
    </div>
  );
}
