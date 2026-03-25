/**
 * Multi-select «как проходит событие» → структурированные сигналы (energy / tempo)
 * для рекомендаций. В UI не показываем названия осей — только человекочитаемые варианты.
 */

export type EventFormatPreset =
  | "calm_relaxed"
  | "educational"
  | "active_energetic";

export type EventSignalsPayload = {
  tempo: "slow" | "medium" | "fast";
  energy: "low" | "medium" | "high";
};

export const EVENT_FORMAT_OPTIONS: readonly { value: EventFormatPreset; label: string }[] = [
  { value: "calm_relaxed", label: "Спокойно" },
  { value: "educational", label: "Познавательно" },
  { value: "active_energetic", label: "Активно" },
] as const;

const PRESET_SET = new Set<string>(EVENT_FORMAT_OPTIONS.map((o) => o.value));

export function isEventFormatPreset(v: string): v is EventFormatPreset {
  return PRESET_SET.has(v);
}

export function normalizeEventFormats(
  selected: string[] | unknown,
): EventFormatPreset[] {
  if (!Array.isArray(selected)) return [];
  const out: EventFormatPreset[] = [];
  for (const v of selected) {
    if (typeof v !== "string") continue;
    if (!isEventFormatPreset(v)) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * Mapping:
 * - Спокойно → energy=low, tempo=slow
 * - Познавательно → energy=low, tempo=medium
 * - Активно → energy=high, tempo=fast
 *
 * Allowed multi combos:
 * - calm_relaxed + educational => low + medium
 * - educational + active_energetic => high + fast
 */
export function mapEventFormatsToSignals(
  selected: EventFormatPreset[],
): EventSignalsPayload {
  if (selected.includes("active_energetic")) {
    return { tempo: "fast", energy: "high" };
  }
  if (selected.includes("educational")) {
    return { tempo: "medium", energy: "low" };
  }
  return { tempo: "slow", energy: "low" };
}

/**
 * Загрузка формы:
 * - если в scheduleJson есть `eventFormats: string[]` → берём оттуда
 * - иначе пытаемся прочитать legacy `eventFormat` (single) или `activityType`
 * - иначе инферим из `signals` (tempo/energy)
 */
export function resolveEventFormatsFromScheduleJson(
  scheduleJson: Record<string, unknown> | null | undefined,
): EventFormatPreset[] {
  if (!scheduleJson || typeof scheduleJson !== "object") return [];

  const rawArr = scheduleJson.eventFormats;
  const normalizedArr = normalizeEventFormats(rawArr);
  if (normalizedArr.length > 0) return normalizedArr;

  const rawSingle = scheduleJson.eventFormat;
  if (typeof rawSingle === "string") {
    if (rawSingle === "playful") return ["educational"];
    if (isEventFormatPreset(rawSingle)) return [rawSingle];
  }

  const legacy = scheduleJson.activityType;
  if (legacy === "calm") return ["calm_relaxed"];
  if (legacy === "educational") return ["educational"];
  if (legacy === "active") return ["active_energetic"];

  // Optional: try to infer from stored signals payload
  const signals = scheduleJson.signals as
    | { tempo?: unknown; energy?: unknown }
    | undefined;
  const tempo = typeof signals?.tempo === "string" ? signals.tempo : null;
  const energy = typeof signals?.energy === "string" ? signals.energy : null;
  if (tempo === "slow" && energy === "low") return ["calm_relaxed"];
  if (tempo === "medium" && energy === "low") return ["educational"];
  if (tempo === "fast" && energy === "high") return ["active_energetic"];

  return [];
}

export function labelForEventFormats(formats: EventFormatPreset[]): string {
  if (!formats || formats.length === 0) return "";
  return formats
    .map((f) => EVENT_FORMAT_OPTIONS.find((o) => o.value === f)?.label ?? f)
    .join(", ");
}
