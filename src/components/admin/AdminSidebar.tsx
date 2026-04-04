"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Shield,
  Users,
  Briefcase,
  CreditCard,
  FileText,
  Image,
  Filter,
  MapPin,
  Globe,
  BarChart2,
  ChartColumn,
} from "lucide-react";
import { SidebarItem } from "@/components/shared/sidebar/SidebarItem";
import { SidebarGroup } from "@/components/shared/sidebar/SidebarGroup";
import { SidebarSubItem } from "@/components/shared/sidebar/SidebarSubItem";
import {
  MODERATION_NAV_ITEMS,
  getModerationItemCount,
  isModerationNavItemActive,
  moderationItemHref,
  type ModerationNavCounts,
} from "@/lib/admin/moderationSidebarConfig";
import { adminPath } from "./AdminNav";
import { SEO_CONTROL_NAV, isSeoNavActive } from "@/lib/admin/seoNavConfig";

interface AdminSidebarProps {
  onNavigate?: () => void;
  moderationCounts: ModerationNavCounts;
  b2bPendingVerificationCount?: number;
}

export function AdminSidebar({
  onNavigate,
  moderationCounts,
  b2bPendingVerificationCount = 0,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;
  const isGroupActive = (paths: string[]) => paths.some((path) => pathname.startsWith(path));

  return (
    <aside className="w-full lg:w-[260px] bg-white">
      {/* Navigation */}
      <nav className="flex flex-col gap-1.5 p-4">
        {/* Dashboard - standalone */}
        <SidebarItem
          href={adminPath("")}
          icon={LayoutDashboard}
          label="Главная"
          isActive={isActive(adminPath(""))}
          onClick={onNavigate}
        />

        {/* Moderation Group */}
        <SidebarGroup
          icon={Shield}
          label="Модерация"
          defaultOpen={isGroupActive([adminPath("/moderation")])}
        >
          {MODERATION_NAV_ITEMS.map((item) => {
            const href = moderationItemHref(item.path);
            const rawCount = getModerationItemCount(item.id, moderationCounts);
            const count =
              rawCount !== undefined && rawCount > 0 ? rawCount : undefined;
            return (
              <SidebarSubItem
                key={item.id}
                href={href}
                label={item.label}
                isActive={isModerationNavItemActive(pathname, item.path)}
                onClick={onNavigate}
                count={count}
              />
            );
          })}
        </SidebarGroup>

        {/* Users Group */}
        <SidebarGroup
          icon={Users}
          label="Пользователи"
          defaultOpen={isGroupActive([adminPath("/users")])}
        >
          <SidebarSubItem
            href={adminPath("/users")}
            label="Пользователи"
            isActive={isActive(adminPath("/users"))}
            onClick={onNavigate}
          />
        </SidebarGroup>

        {/* B2B Group */}
        <SidebarGroup
          icon={Briefcase}
          label="B2B"
          defaultOpen={isGroupActive([adminPath("/b2b")])}
          hasAttention={b2bPendingVerificationCount > 0}
        >
          <SidebarSubItem
            href={adminPath("/b2b/requests")}
            label="Заявки"
            isActive={isActive(adminPath("/b2b/requests"))}
            onClick={onNavigate}
            count={
              b2bPendingVerificationCount > 0
                ? b2bPendingVerificationCount
                : undefined
            }
          />
          <SidebarSubItem
            href={adminPath("/b2b/partners")}
            label="Контрагенты"
            isActive={isActive(adminPath("/b2b/partners"))}
            onClick={onNavigate}
          />
        </SidebarGroup>

        {/* Billing Group */}
        <SidebarGroup
          icon={CreditCard}
          label="Биллинг"
          defaultOpen={isGroupActive([adminPath("/billing")])}
        >
          <SidebarSubItem
            href={adminPath("/billing")}
            label="Обзор"
            isActive={isActive(adminPath("/billing"))}
            onClick={onNavigate}
          />
          <SidebarSubItem
            href={adminPath("/billing/transactions")}
            label="Транзакции"
            isActive={isActive(adminPath("/billing/transactions"))}
            onClick={onNavigate}
          />
          <SidebarSubItem
            href={adminPath("/billing/businesses")}
            label="Балансы"
            isActive={isActive(adminPath("/billing/businesses"))}
            onClick={onNavigate}
          />
          <SidebarSubItem
            href={adminPath("/billing/plans")}
            label="Тарифы"
            isActive={isActive(adminPath("/billing/plans"))}
            onClick={onNavigate}
          />
        </SidebarGroup>

        {/* Commercial Group */}
        <SidebarGroup
          icon={FileText}
          label="Коммерция"
          defaultOpen={isGroupActive([adminPath("/commercial")])}
        >
          <SidebarSubItem
            href={adminPath("/commercial")}
            label="Обзор"
            isActive={isActive(adminPath("/commercial"))}
            onClick={onNavigate}
          />
          <SidebarSubItem
            href={adminPath("/commercial/contracts")}
            label="Договоры"
            isActive={isActive(adminPath("/commercial/contracts"))}
            onClick={onNavigate}
          />
          <SidebarSubItem
            href={adminPath("/commercial/placements")}
            label="Размещения"
            isActive={isActive(adminPath("/commercial/placements"))}
            onClick={onNavigate}
          />
          <SidebarSubItem
            href={adminPath("/commercial/service-placements")}
            label="Услуги"
            isActive={isActive(adminPath("/commercial/service-placements"))}
            onClick={onNavigate}
          />
        </SidebarGroup>

        {/* Content Group */}
        <SidebarGroup
          icon={Image}
          label="Контент"
          defaultOpen={isGroupActive([adminPath("/media")])}
        >
          <SidebarSubItem
            href={adminPath("/media")}
            label="Медиатека"
            isActive={isActive(adminPath("/media"))}
            onClick={onNavigate}
          />
        </SidebarGroup>

        {/* Discovery Group — taxonomy axes + UI filters (не география) */}
        <SidebarGroup
          icon={Filter}
          label="Discovery"
          defaultOpen={isGroupActive([
            adminPath("/taxonomy/signals"),
            adminPath("/taxonomy/categories"),
            adminPath("/taxonomy/event-categories"),
            adminPath("/taxonomy/genres"),
            adminPath("/discovery"),
          ])}
        >
          <SidebarSubItem
            href={adminPath("/taxonomy/signals")}
            label="Сигналы"
            isActive={isActive(adminPath("/taxonomy/signals"))}
            onClick={onNavigate}
          />
          <SidebarSubItem
            href={adminPath("/taxonomy/categories")}
            label="Категории"
            isActive={
              pathname.startsWith(adminPath("/taxonomy/categories")) ||
              pathname.startsWith(adminPath("/taxonomy/event-categories"))
            }
            onClick={onNavigate}
          />
          <SidebarSubItem
            href={adminPath("/discovery/occasions")}
            label="Поводы"
            isActive={pathname.startsWith(adminPath("/discovery/occasions"))}
            onClick={onNavigate}
          />
          <SidebarSubItem
            href={adminPath("/taxonomy/genres")}
            label="Жанры"
            isActive={pathname.startsWith(adminPath("/taxonomy/genres"))}
            onClick={onNavigate}
          />
          <SidebarSubItem
            href={adminPath("/discovery/filters")}
            label="Фильтры"
            isActive={pathname.startsWith(adminPath("/discovery/filters"))}
            onClick={onNavigate}
          />
        </SidebarGroup>

        {/* Ranking Group */}
        <SidebarGroup
          icon={BarChart2}
          label="Ranking"
          defaultOpen={isGroupActive([adminPath("/ranking")])}
        >
          <SidebarSubItem
            href={adminPath("/ranking/stories-intents")}
            label="Stories Intents"
            isActive={pathname.startsWith(adminPath("/ranking/stories-intents"))}
            onClick={onNavigate}
          />
          <SidebarSubItem
            href={adminPath("/ranking/weights")}
            label="Ranking Weights"
            isActive={pathname.startsWith(adminPath("/ranking/weights"))}
            onClick={onNavigate}
          />
          <SidebarSubItem
            href={adminPath("/ranking/boost")}
            label="Boost Rules"
            isActive={pathname.startsWith(adminPath("/ranking/boost"))}
            onClick={onNavigate}
          />
        </SidebarGroup>

        <SidebarItem
          href={adminPath("/analytics")}
          icon={ChartColumn}
          label="Analytics"
          isActive={
            pathname === adminPath("/analytics") ||
            pathname.startsWith(`${adminPath("/analytics")}/`)
          }
          onClick={onNavigate}
        />

        {/* Geography Group */}        <SidebarGroup
          icon={MapPin}
          label="География"
          defaultOpen={isGroupActive([adminPath("/taxonomy/districts"), adminPath("/taxonomy/metro-stations")])}
        >
          <SidebarSubItem
            href={adminPath("/taxonomy/districts")}
            label="Районы"
            isActive={isActive(adminPath("/taxonomy/districts"))}
            onClick={onNavigate}
          />
          <SidebarSubItem
            href={adminPath("/taxonomy/metro-stations")}
            label="Станции метро"
            isActive={isActive(adminPath("/taxonomy/metro-stations"))}
            onClick={onNavigate}
          />
        </SidebarGroup>

        {/* SEO Control Center */}
        <SidebarGroup
          icon={Globe}
          label="SEO"
          defaultOpen={isGroupActive([adminPath("/seo")])}
        >
          {SEO_CONTROL_NAV.map((item) => (
            <SidebarSubItem
              key={item.href}
              href={item.href}
              label={item.label}
              isActive={isSeoNavActive(pathname, item.href)}
              onClick={onNavigate}
            />
          ))}
        </SidebarGroup>
      </nav>
    </aside>
  );
}
