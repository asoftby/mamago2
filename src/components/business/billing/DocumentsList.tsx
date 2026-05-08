"use client";

import { FileText } from "lucide-react";
import { DocumentCard } from "./DocumentCard";
import type { Invoice, Act } from "@/types/billing";

interface DocumentsListProps {
  groupedDocuments: Record<
    string,
    {
      invoices: Invoice[];
      acts: Act[];
    }
  >;
}

export function DocumentsList({ groupedDocuments }: DocumentsListProps) {
  const months = Object.keys(groupedDocuments);

  if (months.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-stone-400" />
        </div>
        <h3 className="text-lg font-semibold text-stone-950 mb-2">
          Документы пока отсутствуют
        </h3>
        <p className="text-sm text-stone-600 max-w-md mx-auto">
          После пополнения баланса здесь появятся счета и закрывающие документы
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {months.map((month) => {
        const { invoices, acts } = groupedDocuments[month];
        const allDocuments = [
          ...invoices.map((inv) => ({ type: "invoice" as const, doc: inv, date: inv.issuedAt })),
          ...acts.map((act) => ({ type: "act" as const, doc: act, date: act.issuedAt })),
        ].sort((a, b) => b.date.getTime() - a.date.getTime());

        return (
          <div key={month}>
            {/* Month Header */}
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-stone-950 uppercase tracking-wide">
                {month}
              </h2>
              <div className="h-px bg-stone-200 mt-2" />
            </div>

            {/* Documents */}
            <div className="space-y-3">
              {allDocuments.map((item) =>
                item.type === "invoice" ? (
                  <DocumentCard
                    key={`invoice-${item.doc.id}`}
                    type="invoice"
                    document={item.doc as Invoice}
                  />
                ) : (
                  <DocumentCard
                    key={`act-${item.doc.id}`}
                    type="act"
                    document={item.doc as Act}
                  />
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
