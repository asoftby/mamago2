import { ReactNode } from "react";

interface PatternBlockProps {
  title: string;
  description?: string;
  desktop: ReactNode;
  mobile: ReactNode;
  note?: string;
}

export function PatternBlock({ title, description, desktop, mobile, note }: PatternBlockProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Pattern Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        {description && (
          <p className="text-xs text-gray-600 mt-0.5">{description}</p>
        )}
      </div>

      {/* Desktop Variant */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium text-gray-500 uppercase">Desktop</span>
        </div>
        <div className="bg-gray-50 rounded border border-gray-200 p-4">
          {desktop}
        </div>
      </div>

      {/* Mobile Variant */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium text-gray-500 uppercase">Mobile</span>
        </div>
        <div className="bg-gray-50 rounded border border-gray-200 p-4 max-w-sm">
          {mobile}
        </div>
      </div>

      {/* Usage Note */}
      {note && (
        <div className="px-4 py-3 bg-blue-50 border-t border-blue-200">
          <p className="text-xs text-blue-800">
            <span className="font-medium">Usage:</span> {note}
          </p>
        </div>
      )}
    </div>
  );
}
