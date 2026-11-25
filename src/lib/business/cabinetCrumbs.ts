import { BUSINESS_PATH_PREFIX } from "@/lib/routing/surface";

export type BusinessCabinetCrumb = {
  label: string;
  /** Omit on the current page crumb. */
  href?: string;
};

export type BusinessCabinetNavModel = {
  showBack: boolean;
  crumbs: BusinessCabinetCrumb[];
  backFallbackHref: string;
};

/** Visible labels for known cabinet path segments (after stripping `/business`). */
const SEGMENT_LABELS: Record<string, string> = {
  analytics: "Аналитика",
  events: "События",
  offers: "Предложения",
  places: "Места",
  publications: "Публикации",
  bookings: "Записи и заказы",
  "booking-units": "Ресурсы и расписание",
  reviews: "Отзывы",
  notifications: "Уведомления",
  team: "Команда",
  promotion: "Продвижение",
  campaigns: "Кампании",
  placements: "Размещения",
  billing: "Финансы",
  plan: "Тариф",
  documents: "Документы",
  requisites: "Реквизиты",
  history: "История операций",
  settings: "Настройки",
  company: "Компания",
  account: "Аккаунт и безопасность",
  profile: "Профиль",
  email: "Email",
  phone: "Телефон",
  password: "Пароль",
  privacy: "Приватность",
  support: "Поддержка mamaGo",
  direct: "Сообщения",
  boost: "Boost",
  activities: "Активности",
  new: "Новая",
  edit: "Редактирование",
  submitted: "На модерации",
  contracts: "Договоры",
  acts: "Акты",
  commercial: "Продвижение",
};

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname || "/";
}

/** Host surface: `/dashboard`; path-prefix: `/business/dashboard`. */
export function isBusinessDashboardPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return path === "/dashboard" || path === `${BUSINESS_PATH_PREFIX}/dashboard`;
}

function getCabinetPathPrefix(pathname: string): string {
  const path = normalizePathname(pathname);
  if (path === BUSINESS_PATH_PREFIX || path.startsWith(`${BUSINESS_PATH_PREFIX}/`)) {
    return BUSINESS_PATH_PREFIX;
  }
  return "";
}

function stripCabinetPrefix(pathname: string): string {
  const path = normalizePathname(pathname);
  const prefix = getCabinetPathPrefix(path);
  if (!prefix) return path;
  if (path === prefix) return "/";
  return path.slice(prefix.length) || "/";
}

function isDynamicIdSegment(segment: string): boolean {
  if (SEGMENT_LABELS[segment]) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) {
    return true;
  }
  // cuid / cuid2 / opaque ids used in app routes
  if (/^[a-z][a-z0-9_-]{16,}$/i.test(segment)) return true;
  return false;
}

function labelForSegment(segment: string): string {
  return SEGMENT_LABELS[segment] ?? segment;
}

function joinCabinetHref(prefix: string, relativePath: string): string {
  if (!relativePath || relativePath === "/") {
    return prefix ? `${prefix}/dashboard` : "/dashboard";
  }
  return `${prefix}${relativePath.startsWith("/") ? relativePath : `/${relativePath}`}`;
}

/**
 * Builds Back + breadcrumb model for business cabinet pages from the URL.
 * Dashboard: single «Кабинет» crumb, no Back.
 * Nested: e.g. settings/company → Кабинет › Настройки › Компания.
 */
export function buildBusinessCabinetNavModel(
  pathname: string,
): BusinessCabinetNavModel {
  const prefix = getCabinetPathPrefix(pathname);
  const backFallbackHref = joinCabinetHref(prefix, "/dashboard");

  if (isBusinessDashboardPath(pathname)) {
    return {
      showBack: false,
      backFallbackHref,
      crumbs: [{ label: "Кабинет" }],
    };
  }

  const relative = stripCabinetPrefix(pathname);
  const segments = relative.split("/").filter(Boolean);
  const crumbs: BusinessCabinetCrumb[] = [
    { label: "Кабинет", href: backFallbackHref },
  ];

  let accumulated = "";
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]!;
    accumulated += `/${segment}`;

    if (isDynamicIdSegment(segment)) {
      continue;
    }

    const hasLaterLabeled = segments
      .slice(i + 1)
      .some((s) => !isDynamicIdSegment(s));

    const crumb: BusinessCabinetCrumb = {
      label: labelForSegment(segment),
    };
    if (hasLaterLabeled) {
      crumb.href = joinCabinetHref(prefix, accumulated);
    }
    crumbs.push(crumb);
  }

  return {
    showBack: true,
    backFallbackHref,
    crumbs,
  };
}
