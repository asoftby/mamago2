interface TransactionAmountProps {
  amount: number;
  currency: string;
}

export function TransactionAmount({ amount, currency }: TransactionAmountProps) {
  const isPositive = amount > 0;
  const absAmount = Math.abs(amount);

  return (
    <span className={`font-medium ${isPositive ? "text-green-600" : "text-gray-900"}`}>
      {isPositive ? "+" : "−"}{absAmount.toFixed(2)} {currency}
    </span>
  );
}
