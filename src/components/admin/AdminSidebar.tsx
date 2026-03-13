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
} from "lucide-react";
import { SidebarItem } from "@/components/shared/sidebar/SidebarItem";
import { SidebarGroup } from "@/components/shared/sidebar/SidebarGroup";
import { SidebarSubItem } from "@/components/shared/sidebar/SidebarSubItem";
import { adminPath } from "./AdminNav";

interface AdminSidebarProps {
  onNavigate?: () => void;
}

export function AdminSidebar({ onNavigate }: AdminSidebarProps) {
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
          hasAttention={true}
        >
          <SidebarSubItem
            href={adminPath("/moderation/queue")}
            label="Очередь"
            isActive={isActive(adminPath("/moderation/queue"))}
            onClick={onNavigate}
            count={12}
          />
          <SidebarSubItem
            href={adminPath("/moderation/places")}
            label="Места"
            isActive={isActive(adminPath("/moderation/places"))}
            onClick={onNavigate}
          />
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
          hasAttention={true}
        >
          <SidebarSubItem
            href={adminPath("/b2b/requests")}
            label="Заявки"
            isActive={isActive(adminPath("/b2b/requests"))}
            onClick={onNavigate}
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

        {/* Discovery Group */}
        <SidebarGroup
          icon={Filter}
          label="Поиск"
          defaultOpen={isGroupActive([adminPath("/taxonomy")])}
        >
          <SidebarSubItem
            href={adminPath("/taxonomy/signals")}
            label="Сигналы"
            isActive={isActive(adminPath("/taxonomy/signals"))}
            onClick={onNavigate}
          />
          <SidebarSubItem
            href={adminPath("/taxonomy/filters")}
            label="Фильтры"
            isActive={isActive(adminPath("/taxonomy/filters"))}
            onClick={onNavigate}
          />
        </SidebarGroup>

        {/* Geography Group */}
        <SidebarGroup
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
      </nav>
    </aside>
  );
}
