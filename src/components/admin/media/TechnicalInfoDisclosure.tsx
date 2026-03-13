"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface TechnicalInfoDisclosureProps {
  storageKey: string;
  publicUrl?: string | null;
  checksum?: string | null;
  filename: string;
}

export function TechnicalInfoDisclosure({
  storageKey,
  publicUrl,
  checksum,
  filename,
}: TechnicalInfoDisclosureProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <h2 className="text-sm font-medium text-gray-700">Техническая информация</h2>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {isOpen && (
        <div className="px-6 pb-6 border-t border-gray-100">
          <dl className="space-y-3 mt-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Storage Key</dt>
              <dd className="mt-1 text-xs text-gray-700 font-mono break-all bg-gray-50 p-2 rounded">
                {storageKey}
              </dd>
            </div>
            {publicUrl && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase">Public URL</dt>
                <dd className="mt-1 text-xs text-gray-700 font-mono break-all bg-gray-50 p-2 rounded">
                  {publicUrl}
                </dd>
              </div>
            )}
            {checksum && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase">Checksum</dt>
                <dd className="mt-1 text-xs text-gray-700 font-mono break-all bg-gray-50 p-2 rounded">
                  {checksum}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">Proxy URL</dt>
              <dd className="mt-1 text-xs text-gray-700 font-mono break-all bg-gray-50 p-2 rounded">
                /api/media/{filename}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
