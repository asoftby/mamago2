"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BillingTransactionStatus, BillingTransactionType } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminSidePanel } from "@/components/admin/ui/AdminSidePanel";
import { TransactionStatusBadge } from "./TransactionStatusBadge";
import { TransactionTypeBadge } from "./TransactionTypeBadge";
import { TransactionAmount } from "./TransactionAmount";

interface RefundSummary {
  originalAmount: number;
  refundedAmount: number;
  availableAmount: number;
  refundCount: number;
  canRefund: boolean;
}

interface TransactionDetails {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  occurredAt: string;
  referenceType: string;
  referenceId: string | null;
  parentTransactionId: string | null;
  failureReason: string | null;
  failureCode: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  billingAccount: {
    id: string;
    business: {
      id: string;
      name: string;
    };
  };
  paymentMethod: {
    type: string;
    cardBrand: string | null;
    cardLast4: string | null;
  } | null;
  subscription: {
    id: string;
    plan: {
      id: string;
      name: string;
    } | null;
  } | null;
  parentTransaction: {
    id: string;
    type: string;
    amount: number;
    occurredAt: string;
  } | null;
  refundSummary: RefundSummary;
  refundTransactions: Array<{
    id: string;
    amount: number;
    status: string;
    occurredAt: string;
    description: string;
    metadata: Record<string, unknown> | null;
  }>;
  auditLogs: Array<{
    id: string;
    actorId: string | null;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    reason: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    actor: {
      id: string;
      email: string;
      role: string;
    } | null;
  }>;
}

interface TransactionDetailsDrawerProps {
  open: boolean;
  transaction: TransactionDetails | null;
  isLoading: boolean;
  onClose: () => void;
  onRefundSuccess: (transactionId: string) => Promise<void>;
}

const REFUNDABLE_TYPES = new Set<BillingTransactionType>([
  BillingTransactionType.LEAD_CHARGE,
  BillingTransactionType.PROMOTION_CHARGE,
  BillingTransactionType.FEATURE_CHARGE,
]);

export function TransactionDetailsDrawer({
  open,
  transaction,
  isLoading,
  onClose,
  onRefundSuccess,
}: TransactionDetailsDrawerProps) {
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [refundIdempotencyKey, setRefundIdempotencyKey] = useState(() => crypto.randomUUID());

  const isRefundAllowed = useMemo(() => {
    if (!transaction) return false;
    if (transaction.type === BillingTransactionType.REFUND) return false;
    if (transaction.status !== BillingTransactionStatus.SUCCEEDED) return false;
    return REFUNDABLE_TYPES.has(transaction.type as BillingTransactionType);
  }, [transaction]);

  const previewAmount = Number(refundAmount || "0");
  const previewIsValid = Number.isFinite(previewAmount) && previewAmount > 0;

  async function handleRefund() {
    if (!transaction) return;

    setRefundError(null);
    setIsSubmittingRefund(true);

    try {
      const response = await fetch("/api/admin/billing/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionId: transaction.id,
          amount: previewAmount,
          currency: "BYN",
          idempotencyKey: refundIdempotencyKey,
          reason: refundReason,
          note: refundNote || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setRefundError(data.error || "Не удалось выполнить возврат");
        return;
      }

      setShowRefundForm(false);
      setRefundAmount("");
      setRefundReason("");
      setRefundNote("");
      setRefundIdempotencyKey(crypto.randomUUID());
      await onRefundSuccess(transaction.id);
    } catch (error) {
      console.error("Refund submit error:", error);
      setRefundError("Не удалось выполнить возврат");
    } finally {
      setIsSubmittingRefund(false);
    }
  }

  return (
    <AdminSidePanel
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title="Детали транзакции"
      size="lg"
    >
      {isLoading || !transaction ? (
        <div className="p-6 text-sm text-gray-500">Загрузка деталей транзакции…</div>
      ) : (
        <div className="p-6 space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <TransactionTypeBadge type={transaction.type as BillingTransactionType} />
                </div>
                <TransactionStatusBadge status={transaction.status as BillingTransactionStatus} />
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-2">
                <TransactionAmount amount={transaction.amount} currency={transaction.currency} />
              </p>
              <p className="text-sm text-gray-600">{transaction.description}</p>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Бизнес</h3>
              <Link
                href={`/admin/businesses/${transaction.billingAccount.business.id}/billing`}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {transaction.billingAccount.business.name}
              </Link>
              <p className="text-xs text-gray-500">ID: {transaction.billingAccount.business.id}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Дата операции</h3>
                <p className="text-sm text-gray-900">
                  {new Date(transaction.occurredAt).toLocaleString("ru-RU")}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Создано</h3>
                <p className="text-sm text-gray-900">
                  {new Date(transaction.createdAt).toLocaleString("ru-RU")}
                </p>
              </div>
            </div>

            {transaction.paymentMethod && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Способ оплаты</h3>
                <p className="text-sm text-gray-900">
                  {transaction.paymentMethod.cardBrand} •••• {transaction.paymentMethod.cardLast4}
                </p>
              </div>
            )}

            {transaction.subscription?.plan && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Подписка</h3>
                <p className="text-sm text-gray-900">{transaction.subscription.plan.name}</p>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Ссылка</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                  {transaction.referenceType}
                </span>
                {transaction.referenceId && (
                  <span className="text-xs text-gray-500 break-all">{transaction.referenceId}</span>
                )}
              </div>
            </div>

            {transaction.parentTransaction && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Родительская транзакция</h3>
                <p className="text-xs text-gray-500 font-mono">{transaction.parentTransaction.id}</p>
              </div>
            )}

            {transaction.status === BillingTransactionStatus.FAILED &&
              (transaction.failureReason || transaction.failureCode) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-red-900 mb-2">Причина ошибки</h3>
                  {transaction.failureReason && (
                    <p className="text-sm text-red-700 mb-1">{transaction.failureReason}</p>
                  )}
                  {transaction.failureCode && (
                    <p className="text-xs text-red-600 font-mono">{transaction.failureCode}</p>
                  )}
                </div>
              )}

            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">Возвраты</h3>
                {isRefundAllowed && transaction.refundSummary.canRefund ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRefundError(null);
                      setShowRefundForm((value) => !value);
                    }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Вернуть
                  </button>
                ) : (
                  <span className="text-xs text-gray-500">Недоступно для этой транзакции</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-gray-500 mb-1">Списано</p>
                  <p className="font-semibold text-gray-900">
                    <TransactionAmount
                      amount={-Math.abs(transaction.refundSummary.originalAmount)}
                      currency={transaction.currency}
                    />
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-gray-500 mb-1">Уже возвращено</p>
                  <p className="font-semibold text-gray-900">
                    <TransactionAmount
                      amount={transaction.refundSummary.refundedAmount}
                      currency={transaction.currency}
                    />
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-gray-500 mb-1">Доступно к возврату</p>
                  <p className="font-semibold text-gray-900">
                    <TransactionAmount
                      amount={transaction.refundSummary.availableAmount}
                      currency={transaction.currency}
                    />
                  </p>
                </div>
              </div>

              {transaction.refundTransactions.length > 0 && (
                <div className="space-y-2">
                  {transaction.refundTransactions.map((refund) => (
                    <div
                      key={refund.id}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900">{refund.description}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(refund.occurredAt).toLocaleString("ru-RU")}
                          </p>
                        </div>
                        <p className="font-semibold text-green-700">
                          <TransactionAmount amount={refund.amount} currency={transaction.currency} />
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showRefundForm && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Сумма возврата
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={refundAmount}
                        onChange={(event) => setRefundAmount(event.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Причина
                      </label>
                      <Input
                        type="text"
                        value={refundReason}
                        onChange={(event) => setRefundReason(event.target.value)}
                        placeholder="Например: компенсация по обращению"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Примечание
                      </label>
                      <Textarea
                        rows={3}
                        value={refundNote}
                        onChange={(event) => setRefundNote(event.target.value)}
                        placeholder="Внутренний комментарий для админки"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg bg-white border border-blue-100 p-3 text-sm">
                    <p className="text-gray-500 mb-2">Preview</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Списано</p>
                        <p className="font-medium text-gray-900">{transaction.refundSummary.originalAmount.toFixed(2)} {transaction.currency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Уже возвращено</p>
                        <p className="font-medium text-gray-900">{transaction.refundSummary.refundedAmount.toFixed(2)} {transaction.currency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Останется доступно</p>
                        <p className="font-medium text-gray-900">
                          {Math.max(0, transaction.refundSummary.availableAmount - (previewIsValid ? previewAmount : 0)).toFixed(2)} {transaction.currency}
                        </p>
                      </div>
                    </div>
                  </div>

                  {refundError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {refundError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowRefundForm(false)}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-white"
                      disabled={isSubmittingRefund}
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRefund()}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      disabled={
                        isSubmittingRefund ||
                        !previewIsValid ||
                        !refundReason.trim() ||
                        previewAmount > transaction.refundSummary.availableAmount
                      }
                    >
                      {isSubmittingRefund ? "Возвращаем…" : "Подтвердить возврат"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Метаданные</h3>
                <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto">
                  {JSON.stringify(transaction.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Audit History</h3>
              {transaction.auditLogs.length > 0 ? (
                <div className="space-y-3">
                  {transaction.auditLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{log.action}</p>
                          <p className="text-xs text-gray-500">
                            {log.actor?.email || "System / unknown actor"} · {log.actorRole}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(log.createdAt).toLocaleString("ru-RU")}
                        </p>
                      </div>
                      {log.reason && (
                        <p className="mt-2 text-sm text-gray-700">
                          <span className="font-medium text-gray-900">Причина:</span> {log.reason}
                        </p>
                      )}
                      {(log.before || log.after) && (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                              Before
                            </p>
                            <pre className="text-xs bg-gray-50 p-2 rounded-lg overflow-x-auto">
                              {JSON.stringify(log.before, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                              After
                            </p>
                            <pre className="text-xs bg-gray-50 p-2 rounded-lg overflow-x-auto">
                              {JSON.stringify(log.after, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Аудит-история для этой транзакции пока пуста</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">ID транзакции</h3>
              <p className="text-xs text-gray-500 font-mono break-all">{transaction.id}</p>
            </div>
        </div>
      )}
    </AdminSidePanel>
  );
}
