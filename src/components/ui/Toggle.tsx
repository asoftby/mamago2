"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  accent?: "orange" | "green";
  "aria-label"?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled,
  accent = "orange",
  "aria-label": ariaLabel,
}: ToggleProps) {
  const enabledClass =
    accent === "green" ? "bg-emerald-500" : "bg-[#EF8759]";
  const focusClass =
    accent === "green"
      ? "focus-visible:ring-emerald-500"
      : "focus-visible:ring-[#EF8759]";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${focusClass} ${checked ? enabledClass : "bg-gray-200"}`}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-in-out"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0px)" }}
      />
    </button>
  );
}
