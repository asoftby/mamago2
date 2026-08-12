import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export type BillingReconciliationRow = {
  accountId: string;
  businessId: string;
  storedBalance: string;
  ledgerBalance: string;
  mismatchAmount: string;
  matched: boolean;
};

export async function reconcileBillingAccounts(): Promise<{
  accountsChecked: number;
  matched: number;
  mismatched: number;
  rows: BillingReconciliationRow[];
}> {
  const accounts = await prisma.billingAccount.findMany({
    select: {
      id: true,
      businessId: true,
      depositBalance: true,
      transactions: {
        where: { status: "SUCCEEDED" },
        select: { amount: true },
      },
    },
    orderBy: { id: "asc" },
  });

  const rows = accounts.map((account) => {
    const ledgerBalance = account.transactions.reduce(
      (sum, transaction) => sum.plus(transaction.amount),
      new Prisma.Decimal(0),
    );
    const mismatchAmount = account.depositBalance.minus(ledgerBalance);
    return {
      accountId: account.id,
      businessId: account.businessId,
      storedBalance: account.depositBalance.toFixed(2),
      ledgerBalance: ledgerBalance.toFixed(2),
      mismatchAmount: mismatchAmount.toFixed(2),
      matched: mismatchAmount.isZero(),
    };
  });

  const matched = rows.filter((row) => row.matched).length;
  return {
    accountsChecked: rows.length,
    matched,
    mismatched: rows.length - matched,
    rows,
  };
}
