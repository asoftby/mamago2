import type { TimeOfDay } from "./types";
import type { CopyVariant, HeroCopyPack, HeroPersonaMode } from "./hero-copy-pools";
import {
  generateHeroCopy as generateHeroCopyCore,
  type HeroPersonaContext as HeroPersonaContextCore,
  type GeneratedHeroCopy as GeneratedHeroCopyCore,
  type GenerateHeroCopyInput as GenerateHeroCopyInputCore,
} from "./hero-copy-engine";

export type { CopyVariant, HeroCopyPack, HeroPersonaMode };

/** Persona for hero copy; extends engine context with optional family UI fields. */
export type HeroPersonaContext = HeroPersonaContextCore & {
  selectedPeopleCount?: number;
};

export type GeneratedHeroCopy = GeneratedHeroCopyCore;

export type GenerateHeroCopyInput = Omit<GenerateHeroCopyInputCore, "persona"> & {
  persona: HeroPersonaContext;
};

export function generateHeroCopy(input: GenerateHeroCopyInput): GeneratedHeroCopy {
  return generateHeroCopyCore({
    ...input,
    persona: {
      mode: input.persona.mode,
      userName: input.persona.userName,
      childName: input.persona.childName,
    },
  });
}

/** Optional debug payload if you need ids / scenario for analytics (not produced by `generateHeroCopy`). */
export type GeneratedHeroCopyWithDebug = GeneratedHeroCopy & {
  debug: {
    scenario: string;
    timeOfDay: TimeOfDay;
    personaMode: HeroPersonaMode;
    selectedIds: {
      microcopyId: string;
      titleId: string;
      subtitleId: string;
    };
  };
};
