import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  CreditCard,
  FileText,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Users,
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
export const BUSINESS_INBOX_HREF = businessRoute("/inbox");
export const BUSINESS_EVENTS_HREF = businessRoute("/events");
export const BUSINESS_OFFERS_HREF = businessRoute("/offers");
export const BUSINESS_PLACES_HREF = businessRoute("/places");
export const BUSINESS_PROMOTION_OVERVIEW_HREF = businessRoute("/promotion");
export const BUSINESS_PROMOTION_CAMPAIGNS_HREF = businessRoute("/promotion/campaigns");
export const BUSINESS_PROMOTION_PLACEMENTS_HREF = businessRoute("/promotion/placements");
export const BUSINESS_TEAM_HREF = businessRoute("/team");
export const BUSINESS_BILLING_PLAN_HREF = businessRoute("/billing/plan");
export const BUSINESS_CONTRACTS_HREF = businessRoute("/documents/contracts");
export const BUSINESS_ACTS_HREF = businessRoute("/documents/acts");

export const businessNavigation: BusinessNavItem[] = [
  {
    type: "item",
    label: "Dashboard",
    href: BUSINESS_DASHBOARD_HREF,
    icon: LayoutDashboard,
    match: [businessRoute("/dashboard")],
  },
  {
    type: "item",
    label: "Входящие",
    href: BUSINESS_INBOX_HREF,
    icon: Bell,
    match: [businessRoute("/inbox")],
  },
  {
    type: "group",
    label: "Publications",
    icon: BarChart3,
    children: [
      { label: "Events", href: BUSINESS_EVENTS_HREF },
      { label: "Offers", href: BUSINESS_OFFERS_HREF },
    ],
    match: [businessRoute("/events"), businessRoute("/offers")],
  },
  {
    type: "item",
    label: "Places",
    href: BUSINESS_PLACES_HREF,
    icon: MapPin,
    match: [businessRoute("/places")],
  },
  {
    type: "group",
    label: "Promotion",
    icon: Megaphone,
    children: [
      { label: "Overview", href: BUSINESS_PROMOTION_OVERVIEW_HREF },
      { label: "Campaigns", href: BUSINESS_PROMOTION_CAMPAIGNS_HREF },
      { label: "Placements", href: BUSINESS_PROMOTION_PLACEMENTS_HREF },
    ],
    match: [
      businessRoute("/promotion"),
      businessRoute("/promotion/campaigns"),
      businessRoute("/promotion/placements"),
      businessRoute("/commercial"),
    ],
  },
  {
    type: "item",
    label: "Team",
    href: BUSINESS_TEAM_HREF,
    icon: Users,
    match: [businessRoute("/team")],
  },
  {
    type: "item",
    label: "Billing",
    href: BUSINESS_BILLING_PLAN_HREF,
    icon: CreditCard,
    match: [businessRoute("/billing")],
  },
  {
    type: "group",
    label: "Documents",
    icon: FileText,
    children: [
      { label: "Contracts", href: BUSINESS_CONTRACTS_HREF },
      { label: "Acts", href: BUSINESS_ACTS_HREF },
    ],
    match: [businessRoute("/documents"), businessRoute("/documents/contracts"), businessRoute("/documents/acts")],
  },
];

export const businessQuickActions = {
  dashboard: BUSINESS_DASHBOARD_HREF,
  places: BUSINESS_PLACES_HREF,
  events: BUSINESS_EVENTS_HREF,
  offers: BUSINESS_OFFERS_HREF,
  promotion: BUSINESS_PROMOTION_OVERVIEW_HREF,
  team: BUSINESS_TEAM_HREF,
  billing: BUSINESS_BILLING_PLAN_HREF,
  contracts: BUSINESS_CONTRACTS_HREF,
  acts: BUSINESS_ACTS_HREF,
};
