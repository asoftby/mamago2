export const BOOST_OPTION_DEFINITIONS = [
  { id: "BOOST_1_DAY", durationDays: 1, envName: "BOOST_PRICE_1_DAY_BYN" },
  { id: "BOOST_3_DAYS", durationDays: 3, envName: "BOOST_PRICE_3_DAYS_BYN" },
  { id: "BOOST_7_DAYS", durationDays: 7, envName: "BOOST_PRICE_7_DAYS_BYN" },
] as const;

export type BoostOptionId = (typeof BOOST_OPTION_DEFINITIONS)[number]["id"];

export function isBoostOptionId(value: string): value is BoostOptionId {
  return BOOST_OPTION_DEFINITIONS.some((option) => option.id === value);
}
