"use client";

import { useCity } from "@/contexts/CityContext";
import { CityBirthdayCtaBlock } from "./CityBirthdayCtaBlock";

export function CityHomeBirthdayCta() {
  const { appendCityQuery, citySlug } = useCity();
  return (
    <CityBirthdayCtaBlock href={appendCityQuery(`/${citySlug}/birthday/make`)} />
  );
}
