"use client";

import { FileText, Download, ExternalLink } from "lucide-react";
import type { LegalDocument } from "@/types/billing";

interface LegalDocumentsBlockProps {
  documents: LegalDocument[];
}

export function LegalDocumentsBlock({ documents }: LegalDocumentsBlockProps) {
  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-stone-700" />
        <h2 className="text-lg font-semibold text-stone-950">
          Юридические документы
        </h2>
      </div>

      <p className="text-sm text-stone-600 mb-4">
        Публичная оферта и политика конфиденциальности, регулирующие использование сервиса
      </p>

      <div className="space-y-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-100 hover:border-stone-200 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#EF8759]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#EF8759]" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-950">
                  {doc.title}
                </p>
                <p className="text-xs text-stone-500">
                  Версия {doc.version} • Действует с{" "}
                  {doc.effectiveDate.toLocaleDateString("ru-RU")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={doc.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </a>
              <a
                href={doc.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Открыть
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
