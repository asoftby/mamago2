export type HomeSectionFeature = "classes" | "birthday" | "routes";

const HOME_SECTION_ENV_KEYS = {
  classes: "ENABLE_HOME_CLASSES",
  birthday: "ENABLE_HOME_BIRTHDAY",
  routes: "ENABLE_HOME_ROUTES",
} as const satisfies Record<HomeSectionFeature, string>;

type HomeSectionFeatureEnv = Partial<
  Record<(typeof HOME_SECTION_ENV_KEYS)[HomeSectionFeature], string | undefined>
> & {
  [key: string]: string | undefined;
};

function isExplicitlyEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function getHomeSectionAvailability(
  env: HomeSectionFeatureEnv = process.env,
): Record<HomeSectionFeature, boolean> {
  return {
    classes: isExplicitlyEnabled(env[HOME_SECTION_ENV_KEYS.classes]),
    birthday: isExplicitlyEnabled(env[HOME_SECTION_ENV_KEYS.birthday]),
    routes: isExplicitlyEnabled(env[HOME_SECTION_ENV_KEYS.routes]),
  };
}
