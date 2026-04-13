import { formatTransactionAmount } from "@/lib/formatters/format-price";

interface TransactionAmountProps {
  amount: number;
  currency?: string;
}

export function TransactionAmount({ amount }: TransactionAmountProps) {
  const isPositive = amount > 0;

  return (
    <span className={`font-medium ${isPositive ? "text-green-600" : "text-gray-900"}`}>
      {formatTransactionAmount(amount)}
    </span>
  );
}
