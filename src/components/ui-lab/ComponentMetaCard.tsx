"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import type { ComponentMetaCardProps, ComponentStatus } from "./types";

const STATUS_CONFIG: Record<ComponentStatus, { label: string; className: string }> = {
  rendered: {
    label: "Rendered",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  draft: {
    label: "Draft",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
  deprecated: {
    label: "Deprecated",
    className: "bg-red-100 text-red-800 border-red-200",
  },
};

export function ComponentMetaCard({
  title,
  sourcePath,
  status,
  usedIn,
  description,
  children,
  className = "",
}: ComponentMetaCardProps) {
  const [isUsageExpanded, setIsUsageExpanded] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const usageCount = usedIn.length;
  const displayedUsages = isUsageExpanded ? usedIn : usedIn.slice(0, 3);
  const hasMoreUsages = usedIn.length > 3;

  const handleCopyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const statusConfig = STATUS_CONFIG[status];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Metadata Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
            {description && (
              <p className="text-sm text-gray-600 mb-2">{description}</p>
            )}
            
            {/* Source Path */}
            <div className="flex items-center gap-2 mt-2">
              <code className="text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200 text-gray-700 font-mono">
                {sourcePath}
              </code>
              <button
                onClick={() => handleCopyPath(sourcePath)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Copy path"
              >
                {copiedPath === sourcePath ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 ml-4">
            <span
              className={`px-2.5 py-1 text-xs font-medium rounded-full border ${statusConfig.className}`}
            >
              {statusConfig.label}
            </span>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              USED ({usageCount})
            </span>
          </div>
        </div>

        {/* Used In Section */}
        {usedIn.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">Used in:</h4>
              {hasMoreUsages && (
                <button
                  onClick={() => setIsUsageExpanded(!isUsageExpanded)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {isUsageExpanded ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      Show all ({usageCount})
                    </>
                  )}
                </button>
              )}
            </div>

            <ul className="space-y-2">
              {displayedUsages.map((path, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <code className="text-xs text-gray-700 font-mono break-all">
                      {path}
                    </code>
                    <button
                      onClick={() => handleCopyPath(path)}
                      className="p-0.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                      title="Copy path"
                    >
                      {copiedPath === path ? (
                        <Check className="w-3 h-3 text-green-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400" />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {!isUsageExpanded && hasMoreUsages && (
              <p className="text-xs text-gray-500 mt-3 italic">
                ...and {usedIn.length - 3} more
              </p>
            )}
          </div>
        )}

        {usedIn.length === 0 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <p className="text-sm text-gray-500 italic">
              Not used in production yet (lab-only component)
            </p>
          </div>
        )}
      </div>

      {/* Demo Content */}
      {children && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          {children}
        </div>
      )}
    </div>
  );
}
