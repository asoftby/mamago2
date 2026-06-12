import { HERO_COPY_POOLS, type CopyVariant, type HeroCopyPack, type WeatherScenario } from "./hero-copy-pools";
import { selectCopyVariantsWithAntiRepeat } from "./anti-repeat-engine";
import type { AntiRepeatState, HeroCopySelectionIds } from "./anti-repeat-types";
import { normalizeWeatherScenario } from "./anti-repeat-types";
import type { TimeOfDay } from "./types";

// --- Types (engine surface) ---

export type HeroPersonaContext = {
  mode: "guest" | "self" | "child" | "family";
  userName?: string | null;
  childName?: string | null;
};

export type GenerateHeroCopyInput = {
  weather: {
    scenario: string;
    timeOfDay: TimeOfDay;
    emoji: string;
  };
  persona: HeroPersonaContext;
  cityName?: string;
};

export type GeneratedHeroCopy = {
  microcopy: string;
  title: string;
};

// --- Helpers ---

/** Trim, collapse spaces, cap length for safe display in copy. */
export function sanitizeDisplayName(name: string | null | undefined): string {
  if (name == null) return "";
  return name.replace(/\s+/g, " ").trim().slice(0, 80);
}

export function applyTemplate(text: string, persona: HeroPersonaContext): string {
  const user = sanitizeDisplayName(persona.userName);
  const child = sanitizeDisplayName(persona.childName);
  return text
    .replaceAll("{userName}", user || "ты")
    .replaceAll("{childName}", child || "малыш");
}

function pickWeighted(variants: CopyVariant[]): CopyVariant {
  if (variants.length === 0) {
    throw new Error("hero-copy-engine: empty variant list");
  }
  if (variants.length === 1) return variants[0];
  const weights = variants.map((v) => v.weight ?? 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < variants.length; i++) {
    r -= weights[i];
    if (r <= 0) return variants[i];
  }
  return variants[variants.length - 1];
}

function needsUserName(v: CopyVariant): boolean {
  return Boolean(v.usesName || v.text.includes("{userName}"));
}

function needsChildName(v: CopyVariant): boolean {
  return Boolean(v.usesChildName || v.text.includes("{childName}"));
}

function eligibleVariants(variants: CopyVariant[], persona: HeroPersonaContext): CopyVariant[] {
  const hasUser = Boolean(sanitizeDisplayName(persona.userName));
  const hasChild = Boolean(sanitizeDisplayName(persona.childName));

  const strict = variants.filter((v) => {
    if (needsUserName(v) && !hasUser) return false;
    if (needsChildName(v) && !hasChild) return false;
    return true;
  });
  if (strict.length > 0) return strict;

  const noPlaceholders = variants.filter(
    (v) => !needsUserName(v) && !needsChildName(v) && !v.text.includes("{userName}") && !v.text.includes("{childName}"),
  );
  return noPlaceholders.length > 0 ? noPlaceholders : variants;
}

function resolveScenario(raw: string): WeatherScenario {
  if (raw != null && raw in HERO_COPY_POOLS) {
    return raw as WeatherScenario;
  }
  return "unknown";
}

function packIsComplete(pack: HeroCopyPack): boolean {
  return pack.microcopy.length > 0 && pack.titles.length > 0;
}

/**
 * Picks a copy pack: scenario × mode, then fallbacks, ending with unknown + guest.
 */
function resolvePack(scenario: WeatherScenario, mode: HeroPersonaContext["mode"]): HeroCopyPack {
  const tryOrder: Array<() => HeroCopyPack | null> = [
    () => {
      const p = HERO_COPY_POOLS[scenario]?.[mode];
      return p && packIsComplete(p) ? p : null;
    },
    () => {
      const p = HERO_COPY_POOLS.unknown?.[mode];
      return p && packIsComplete(p) ? p : null;
    },
    () => {
      const p = HERO_COPY_POOLS[scenario]?.guest;
      return p && packIsComplete(p) ? p : null;
    },
    () => HERO_COPY_POOLS.unknown.guest,
  ];

  for (const fn of tryOrder) {
    const p = fn();
    if (p && packIsComplete(p)) return p;
  }

  return HERO_COPY_POOLS.unknown.guest;
}

// --- Main ---

/**
 * Builds hero strings from a resolved pack and variant ids (anti-repeat selection).
 * Returns null if ids are missing from the pack or persona cannot use those variants.
 */
export function generateHeroCopyFromSelection(
  input: GenerateHeroCopyInput,
  selection: HeroCopySelectionIds,
): GeneratedHeroCopy | null {
  const scenario = resolveScenario(input.weather.scenario);
  const pack = resolvePack(scenario, input.persona.mode);
  const microVariant = pack.microcopy.find((v) => v.id === selection.microcopyId);
  const titleVariant = pack.titles.find((v) => v.id === selection.titleId);
  if (!microVariant || !titleVariant) return null;
  if (eligibleVariants([microVariant], input.persona).length === 0) return null;
  if (eligibleVariants([titleVariant], input.persona).length === 0) return null;

  const microcopy = applyTemplate(microVariant.text, input.persona);
  const title = applyTemplate(titleVariant.text, input.persona);

  return { microcopy, title };
}

/**
 * Same output as {@link generateHeroCopy}, plus variant ids for analytics / anti-repeat persistence.
 */
export function generateHeroCopyWithSelection(
  input: GenerateHeroCopyInput,
): GeneratedHeroCopy & { selection: HeroCopySelectionIds } {
  const scenario = resolveScenario(input.weather.scenario);
  const pack = resolvePack(scenario, input.persona.mode);

  const microVariant = pickWeighted(eligibleVariants(pack.microcopy, input.persona));
  const titleVariant = pickWeighted(eligibleVariants(pack.titles, input.persona));

  const microcopy = applyTemplate(microVariant.text, input.persona);
  const title = applyTemplate(titleVariant.text, input.persona);

  return {
    microcopy,
    title,
    selection: {
      microcopyId: microVariant.id,
      titleId: titleVariant.id,
    },
  };
}

export function generateHeroCopyWithAntiRepeat(
  input: GenerateHeroCopyInput,
  state: AntiRepeatState,
): { copy: GeneratedHeroCopy; selection: HeroCopySelectionIds } | null {
  const scenario = resolveScenario(input.weather.scenario);
  const pack = resolvePack(scenario, input.persona.mode);
  const microcopy = eligibleVariants(pack.microcopy, input.persona);
  const titles = eligibleVariants(pack.titles, input.persona);
  if (microcopy.length === 0 || titles.length === 0) return null;

  const arScenario = normalizeWeatherScenario(input.weather.scenario);
  const selection = selectCopyVariantsWithAntiRepeat({
    scenario: arScenario,
    packs: { microcopy, titles },
    state,
  });
  if (!selection) return null;
  const copy = generateHeroCopyFromSelection(input, selection);
  if (!copy) return null;
  return { copy, selection };
}

export function generateHeroCopy(input: GenerateHeroCopyInput): GeneratedHeroCopy {
  const { microcopy, title } = generateHeroCopyWithSelection(input);
  return { microcopy, title };
}
