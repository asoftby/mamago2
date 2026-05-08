"use client";

import { FileText, Download } from "lucide-react";
import type { Invoice, Act } from "@/types/billing";
import { getInvoiceStatusLabel, getActStatusLabel } from "@/types/billing";

type DocumentCardProps =
  | {
      type: "invoice";
      document: Invoice;
    }
  | {
      type: "act";
      document: Act;
    };

export function DocumentCard({ type, document }: DocumentCardProps) {
  const isInvoice = type === "invoice";
  const doc = document as Invoice | Act;

  // Get status info
  const status = doc.status;
  const statusLabel = isInvoice
    ? getInvoiceStatusLabel(status as Invoice["status"])
    : getActStatusLabel(status as Act["status"]);

  // Status colors
  const statusColors: Record<string, string> = {
    pending: "bg-orange-100 text-orange-700 border-orange-200",
    paid: "bg-green-100 text-green-700 border-green-200",
    cancelled: "bg-stone-100 text-stone-600 border-stone-200",
    overdue: "bg-red-100 text-red-700 border-red-200",
    draft: "bg-stone-100 text-stone-600 border-stone-200",
    signed: "bg-blue-100 text-blue-700 border-blue-200",
    active: "bg-green-100 text-green-700 border-green-200",
  };

  const statusColor = statusColors[status] || statusColors.draft;

  // Document type label
  const typeLabel = isInvoice ? "Счёт" : "Акт";

  // Date
  const date = isInvoice
    ? (doc as Invoice).issuedAt
    : (doc as Act).issuedAt;

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 hover:border-stone-300 transition-colors shadow-sm">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Icon + Info */}
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-stone-600" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Type + Number */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-stone-950">
                {typeLabel} №{doc.number}
              </h3>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${statusColor}`}
              >
                {statusLabel}
              </span>
            </div>

            {/* Date */}
            <p className="text-xs text-stone-500 mb-2">
              {date.toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>

            {/* Description */}
            {doc.description && (
              <p className="text-sm text-stone-600 line-clamp-1">
                {doc.description}
              </p>
            )}
          </div>
        </div>

        {/* Right: Amount + Action */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <p className="text-lg font-semibold text-stone-950">
            {doc.amount.toFixed(2)} {doc.currency}
          </p>

          {doc.pdfUrl && (
            <a
              href={doc.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#EF8759] rounded-lg hover:bg-[#EF8759]/90 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Скачать PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
