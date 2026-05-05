import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  Megaphone,
  Users,
  Wallet,
} from "lucide-react";
import { buildBusinessPath } from "@/lib/routing/surface";

export type BusinessNavLink = {
  label: string;
  href: string;
};

export type BusinessNavItem =
  | {
      type: "item";
      label: string;
      href: string;
      icon: LucideIcon;
      match?: string[];
    }
  | {
      type: "group";
      label: string;
      icon: LucideIcon;
      children: Array<BusinessNavLink>;
      match?: string[];
    };

export const businessRoute = (path: string) => buildBusinessPath(path);

export const BUSINESS_DASHBOARD_HREF = businessRoute("/dashboard");
export const BUSINESS_ROOT_HREF = businessRoute("/");
export const BUSINESS_PUBLICATIONS_HREF = businessRoute("/publications");
export const BUSINESS_PUBLICATIONS_EVENTS_HREF = businessRoute("/publications/events");
export const BUSINESS_PUBLICATIONS_PLACES_HREF = businessRoute("/publications/places");
export const BUSINESS_PUBLICATIONS_OFFERS_HREF = businessRoute("/publications/offers");
export const BUSINESS_EVENTS_HREF = businessRoute("/events");
export const BUSINESS_BOOKINGS_HREF = businessRoute("/bookings");
export const BUSINESS_TEAM_HREF = businessRoute("/team");
export const BUSINESS_PROMOTION_OVERVIEW_HREF = businessRoute("/promotion");
export const BUSINESS_BILLING_TRANSACTIONS_HREF = businessRoute("/billing/transactions");
export const BUSINESS_BILLING_PLAN_HREF = businessRoute("/billing/plan");
export const BUSINESS_SETTINGS_HREF = businessRoute("/settings");
export const BUSINESS_CONTRACTS_HREF = businessRoute("/documents/contracts");
export const BUSINESS_ACTS_HREF = businessRoute("/documents/acts");
export const BUSINESS_OFFERS_HREF = businessRoute("/offers");

export const businessNavigation: BusinessNavItem[] = [
  {
    type: "item",
    label: "Панель управления",
    href: BUSINESS_DASHBOARD_HREF,
    icon: LayoutDashboard,
    match: [businessRoute("/dashboard")],
  },
  {
    type: "item",
    label: "Мой бизнес",
    href: BUSINESS_ROOT_HREF,
    icon: Briefcase,
    match: [businessRoute("/")],
  },
  {
    type: "group",
    label: "Публикации",
    icon: ClipboardList,
    children: [
      {
        label: "События",
        href: BUSINESS_PUBLICATIONS_EVENTS_HREF,
      },
      {
        label: "Места",
        href: BUSINESS_PUBLICATIONS_PLACES_HREF,
      },
      {
        label: "Предложения",
        href: BUSINESS_PUBLICATIONS_OFFERS_HREF,
      },
    ],
    match: [
      businessRoute("/publications"),
      businessRoute("/publications/events"),
      businessRoute("/publications/places"),
      businessRoute("/publications/offers"),
    ],
  },
  {
    type: "item",
    label: "Записи и заказы",
    href: BUSINESS_BOOKINGS_HREF,
    icon: CalendarDays,
    match: [businessRoute("/bookings")],
  },
  {
    type: "item",
    label: "Клиенты",
    href: BUSINESS_TEAM_HREF,
    icon: Users,
    match: [businessRoute("/team")],
  },
  {
    type: "item",
    label: "Аналитика",
    href: BUSINESS_DASHBOARD_HREF,
    icon: BarChart3,
    match: [businessRoute("/dashboard")],
  },
  {
    type: "item",
    label: "Продвижение",
    href: BUSINESS_PROMOTION_OVERVIEW_HREF,
    icon: Megaphone,
    match: [businessRoute("/promotion"), businessRoute("/commercial")],
  },
  {
    type: "item",
    label: "Платежи и выплаты",
    href: BUSINESS_BILLING_TRANSACTIONS_HREF,
    icon: Wallet,
    match: [businessRoute("/billing")],
  },
  {
    type: "item",
    label: "Настройки и помощь",
    href: BUSINESS_SETTINGS_HREF,
    icon: CircleHelp,
    match: [businessRoute("/settings")],
  },
];

export const businessQuickActions = {
  dashboard: BUSINESS_DASHBOARD_HREF,
  root: BUSINESS_ROOT_HREF,
  publications: BUSINESS_PUBLICATIONS_HREF,
  publicationsEvents: BUSINESS_PUBLICATIONS_EVENTS_HREF,
  publicationsPlaces: BUSINESS_PUBLICATIONS_PLACES_HREF,
  publicationsOffers: BUSINESS_PUBLICATIONS_OFFERS_HREF,
  events: BUSINESS_EVENTS_HREF,
  bookings: BUSINESS_BOOKINGS_HREF,
  promotion: BUSINESS_PROMOTION_OVERVIEW_HREF,
  team: BUSINESS_TEAM_HREF,
  billing: BUSINESS_BILLING_TRANSACTIONS_HREF,
  settings: BUSINESS_SETTINGS_HREF,
};
