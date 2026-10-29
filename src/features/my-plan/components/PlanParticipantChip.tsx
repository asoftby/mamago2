"use client";

const PALETTE = [
  { bg: "#FBE3D7", fg: "#8D432B" }, // peach
  { bg: "#F6E8C9", fg: "#806024" }, // honey
  { bg: "#E2EAD5", fg: "#48653D" }, // sage
  { bg: "#F0DDEA", fg: "#754865" }, // rose
  { bg: "#E6E3F4", fg: "#595077" }, // lavender
  { bg: "#F5E4D5", fg: "#80543B" }, // sand
] as const;
/** Stable by participant identifier, not render order; no personal data is stored. */
export function planParticipantPalette(id: string | null | undefined) {
  if (!id) return { bg: "#EEE6DC", fg: "#5F5145" };
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return PALETTE[(hash >>> 0) % PALETTE.length];
}
export function PlanParticipantChip({ id, name }: { id?: string | null; name?: string | null }) {
  const label = name?.trim() || "Вся семья";
  const colors = planParticipantPalette(id);
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
      style={{ background: colors.bg, color: colors.fg }}>
      <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current/15 text-[11px]">
        {id ? label.charAt(0).toUpperCase() : "•"}
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}
