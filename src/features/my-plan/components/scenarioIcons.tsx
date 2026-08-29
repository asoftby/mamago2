/** Small inline icon set shared by the Scenario page (server) and its
 * draft editor (client) — mirrors the mockup's inline SVGs rather than
 * pulling in a generic icon library for one-off shapes. */

type IconProps = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IcBack({ className }: IconProps) {
  return (
    <svg className={className} width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="2">
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

export function IcMapPin({ className }: IconProps) {
  return (
    <svg className={className} width="13" height="13" viewBox="0 0 24 24" {...base} strokeWidth="1.8">
      <path d="M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  );
}

export function IcClock({ className }: IconProps) {
  return (
    <svg className={className} width="13" height="13" viewBox="0 0 24 24" {...base} strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IcCalendar({ className }: IconProps) {
  return (
    <svg className={className} width="13" height="13" viewBox="0 0 24 24" {...base} strokeWidth="1.8">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

export function IcAlert({ className }: IconProps) {
  return (
    <svg className={className} width="13" height="13" viewBox="0 0 24 24" {...base} strokeWidth="2">
      <path d="M12 9v4M12 16.5v.5" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function IcRoute({ className }: IconProps) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" {...base} strokeWidth="1.8">
      <path d="M5 17h2l1.5-4.5A2 2 0 0 1 10.4 11h3.2a2 2 0 0 1 1.9 1.5L17 17h2" />
      <circle cx="7.5" cy="17.5" r="1.8" />
      <circle cx="16.5" cy="17.5" r="1.8" />
    </svg>
  );
}

export function IcCheck({ className }: IconProps) {
  return (
    <svg className={className} width="13" height="13" viewBox="0 0 24 24" {...base} strokeWidth="2.4">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IcSwap({ className }: IconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" {...base} strokeWidth="1.9">
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  );
}

export function IcPlus({ className }: IconProps) {
  return (
    <svg className={className} width="17" height="17" viewBox="0 0 24 24" {...base} strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IcClose({ className }: IconProps) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" {...base} strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
