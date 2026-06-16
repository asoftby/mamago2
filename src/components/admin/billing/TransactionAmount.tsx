import { formatTransactionAmount } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";

interface TransactionAmountProps {
  amount: number;
  currency?: string;
}

export function TransactionAmount({ amount }: TransactionAmountProps) {
  const isPositive = amount > 0;

  return (
    <span className={`font-medium ${isPositive ? "text-green-600" : "text-gray-900"}`}>
      {renderCurrencyText(formatTransactionAmount(amount))}
    </span>
  );
}
