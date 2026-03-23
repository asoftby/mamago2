import type { AgeOption } from "@/lib/config/ages";

/** Places / events / offers that expose resolved age options for ranking */
export type WithAgeOptions = {
  ageOptions: AgeOption[];
};
