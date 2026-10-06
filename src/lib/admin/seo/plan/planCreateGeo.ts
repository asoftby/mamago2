import type { GeoScope } from "@prisma/client";
import type { SeoGeoContextKind } from "@/lib/admin/seo/geo/types";

export type PlanCreateGeoOption = {
  value: GeoScope;
  label: string;
};

export type PlanCreateGeoConfig =
  | {
      canCreate: false;
      helperText: string;
      defaultGeo: null;
      options: [];
    }
  | {
      canCreate: true;
      helperText: null;
      defaultGeo: GeoScope;
      options: PlanCreateGeoOption[];
    };

/**
 * Valid geography choices for «Добавить тему» based on SEO geo context.
 * Does not invent COUNTRY for `all` — creation is disabled until a concrete geo is selected.
 */
export function resolvePlanCreateGeoConfig(input: {
  contextKind: SeoGeoContextKind;
  cityName: string | null;
  regionName: string | null;
  countryName: string | null;
  cityId: string | null;
  regionId: string | null;
}): PlanCreateGeoConfig {
  if (input.contextKind === "all") {
    return {
      canCreate: false,
      helperText: "Выберите город, регион или страну для создания темы",
      defaultGeo: null,
      options: [],
    };
  }

  if (input.contextKind === "country") {
    return {
      canCreate: true,
      helperText: null,
      defaultGeo: "COUNTRY",
      options: [
        {
          value: "COUNTRY",
          label: input.countryName ?? "Страна",
        },
      ],
    };
  }

  if (input.contextKind === "region") {
    if (!input.regionId) {
      return {
        canCreate: false,
        helperText: "Выберите город, регион или страну для создания темы",
        defaultGeo: null,
        options: [],
      };
    }
    return {
      canCreate: true,
      helperText: null,
      defaultGeo: "REGION",
      options: [
        {
          value: "REGION",
          label: input.regionName ?? "Регион",
        },
      ],
    };
  }

  // city
  const options: PlanCreateGeoOption[] = [];
  if (input.cityId) {
    options.push({
      value: "CITY",
      label: input.cityName ?? "Город",
    });
  }
  if (input.regionId) {
    options.push({
      value: "REGION",
      label: input.regionName ?? "Регион",
    });
  }
  if (options.length === 0) {
    return {
      canCreate: false,
      helperText: "Выберите город, регион или страну для создания темы",
      defaultGeo: null,
      options: [],
    };
  }
  return {
    canCreate: true,
    helperText: null,
    defaultGeo: options[0]!.value,
    options,
  };
}

export function planItemIdsForGeoScope(
  geo: GeoScope,
  ids: { cityId: string | null; regionId: string | null },
): { cityId: string | null; regionId: string | null } {
  if (geo === "CITY") {
    return { cityId: ids.cityId, regionId: null };
  }
  if (geo === "REGION") {
    return { cityId: null, regionId: ids.regionId };
  }
  return { cityId: null, regionId: null };
}
