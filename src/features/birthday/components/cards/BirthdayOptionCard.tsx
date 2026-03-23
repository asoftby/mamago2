"use client";

import { cn } from "@/lib/utils";

interface BirthdayOptionCardProps {
  emoji?: string;
  label: string;
  sublabel?: string;
  selected: boolean;
  onClick: () => void;
}

export function BirthdayOptionCard({
  emoji,
  label,
  sublabel,
  selected,
  onClick,
}: BirthdayOptionCardProps) {
  // Toggle behavior: clicking selected option unselects it
  const handleClick = () => {
    onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "w-full text-left rounded-2xl border-2 px-5 py-4 transition-all duration-150",
        "hover:border-[#EF8759] hover:bg-orange-50/50",
        "active:scale-[0.98]",
        selected
          ? "border-[#EF8759] bg-orange-50 shadow-sm"
          : "border-border bg-white"
      )}
    >
      <div className="flex items-center gap-3">
        {emoji && (
          <span className="text-2xl leading-none shrink-0">{emoji}</span>
        )}
        <div className="min-w-0">
          <div className={cn("font-semibold text-[0.9375rem]", selected ? "text-[#EF8759]" : "text-foreground")}>
            {label}
          </div>
          {sublabel && (
            <div className="text-xs text-muted-foreground mt-0.5">{sublabel}</div>
          )}
        </div>
        <div className={cn(
          "ml-auto shrink-0 h-5 w-5 rounded-full border-2 transition-all",
          selected ? "border-[#EF8759] bg-[#EF8759]" : "border-border"
        )}>
          {selected && (
            <svg viewBox="0 0 20 20" fill="white" className="h-full w-full p-0.5">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}
