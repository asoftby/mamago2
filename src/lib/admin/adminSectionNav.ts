export type AdminNavMatchRule =
  | { type: "exact"; value: string }
  | { type: "prefix"; value: string };

export interface AdminSectionNavItem {
  id: string;
  label: string;
  href: string;
  matchers?: AdminNavMatchRule[];
  badgeCountKey?: string;
}

export interface AdminSectionNavConfig {
  id: string;
  label: string;
  href: string;
  items: AdminSectionNavItem[];
}

function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function isAdminNavRuleActive(pathname: string, rule: AdminNavMatchRule) {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedValue = normalizePathname(rule.value);

  if (rule.type === "exact") {
    return normalizedPathname === normalizedValue;
  }

  return (
    normalizedPathname === normalizedValue ||
    normalizedPathname.startsWith(`${normalizedValue}/`)
  );
}

export function isAdminSectionNavItemActive(
  pathname: string,
  item: AdminSectionNavItem,
) {
  const matchers =
    item.matchers && item.matchers.length > 0
      ? item.matchers
      : [{ type: "prefix", value: item.href } satisfies AdminNavMatchRule];

  return matchers.some((rule) => isAdminNavRuleActive(pathname, rule));
}

export function getActiveAdminSectionNavItem(
  pathname: string,
  config: AdminSectionNavConfig,
) {
  return config.items.find((item) => isAdminSectionNavItemActive(pathname, item)) ?? null;
}

export function isAdminSectionActive(
  pathname: string,
  config: AdminSectionNavConfig,
) {
  return (
    normalizePathname(pathname) === normalizePathname(config.href) ||
    config.items.some((item) => isAdminSectionNavItemActive(pathname, item))
  );
}
