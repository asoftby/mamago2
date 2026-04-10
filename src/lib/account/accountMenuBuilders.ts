import {
  Briefcase,
  ClipboardList,
  CalendarDays,
  LayoutDashboard,
  MapPin,
  Settings,
  Shield,
  User,
  UserCircle,
} from "lucide-react";
import type { AccountMenuUser } from "@/lib/account/types";
import { mapFamilyRoleToLabel } from "@/lib/account/mapFamilyRoleToLabel";
import type { AccountMode } from "@/contexts/AccountModeContext";
import type { AccountMenuRow } from "@/components/account/types";
import type { AccountDropdownModel } from "@/components/account/AccountDropdown.types";
import {
  ADMIN_PATH_PREFIX,
  buildAdminPath,
  buildBusinessPath,
  buildPublicPath,
} from "@/lib/routing/surface";

const isAdminRole = (role: string) =>
  role === "ADMIN" || role === "MODERATOR";

/**
 * Публичный сайт + личный кабинет /me: меню в шапке (режим personal или business).
 */
export function buildPublicSiteAccountModel(input: {
  user: AccountMenuUser;
  mode: AccountMode;
  initials: string;
  onNavigate: () => void;
  onGoToBusinessAccount: () => void;
  onGoToPersonalAccount: () => void;
  onLogout: () => void | Promise<void>;
  loggingOut: boolean;
}): AccountDropdownModel {
  const {
    user,
    mode,
    initials,
    onNavigate,
    onGoToBusinessAccount,
    onGoToPersonalAccount,
    onLogout,
    loggingOut,
  } = input;

  const emailPrefix = user.email?.split("@")[0] ?? user.email ?? "";
  const displayName = user.displayName?.trim() || emailPrefix;

  const roleRu = mapFamilyRoleToLabel(user.familyRole ?? undefined);
  const personaSubtitle = roleRu || null;

  const header = {
    email: user.email,
    displayName,
    initials,
    roleLabel: null as string | null,
    avatarUrl: user.avatarUrl ?? null,
    personaSubtitle,
  };

  if (mode === "personal") {
    const mainItems: AccountMenuRow[] = [
      {
        key: "profile",
        type: "link",
        href: buildPublicPath("/me"),
        label: "Профиль",
        icon: User,
      },
      {
        key: "plan",
        type: "link",
        href: buildPublicPath("/me/plan"),
        label: "Мой план",
        icon: CalendarDays,
      },
    ];

    const contextItems: AccountMenuRow[] | undefined = isAdminRole(user.role)
      ? [
          {
            key: "admin",
            type: "link",
            href: ADMIN_PATH_PREFIX,
            label: "Админ панель",
            icon: Shield,
            variant: "accent",
          },
        ]
      : [
          {
            key: "to-business",
            type: "button",
            label: "Перейти в Бизнес-аккаунт",
            icon: Briefcase,
            variant: "accent",
            onClick: () => {
              onGoToBusinessAccount();
            },
          },
        ];

    return {
      header,
      mainItems,
      contextItems,
      onLogout,
      logoutMode: "fetch",
      loggingOut,
      onNavigate,
    };
  }

  return {
    sheetTitle: "Бизнес-аккаунт",
    header,
    mainItems: [
      {
        key: "dash",
        type: "link",
        href: buildBusinessPath("/dashboard"),
        label: "Дашборд",
        icon: LayoutDashboard,
      },
      {
        key: "places",
        type: "link",
        href: buildBusinessPath("/places"),
        label: "Мои места",
        icon: MapPin,
      },
      {
        key: "commercial",
        type: "link",
        href: buildBusinessPath("/commercial"),
        label: "Заявки и коммерция",
        icon: ClipboardList,
      },
    ],
    contextItems: [
      {
        key: "to-personal",
        type: "button",
        label: "Перейти в Личный аккаунт",
        icon: User,
        variant: "accent",
        onClick: () => {
          onGoToPersonalAccount();
        },
      },
    ],
    onLogout,
    logoutMode: "fetch",
    loggingOut,
    onNavigate,
  };
}

/**
 * Админка: профиль, настройки, переход в личный кабинет, выход (form).
 */
export function buildAdminAccountModel(input: {
  userEmail: string;
  initials: string;
  goToPersonalAccount: () => void;
  onNavigate: () => void;
}): AccountDropdownModel {
  const { userEmail, initials, goToPersonalAccount, onNavigate } = input;

  return {
    sheetTitle: "Профиль",
    header: {
      email: userEmail,
      displayName: userEmail.split("@")[0] ?? userEmail,
      initials,
      roleLabel: "Администратор",
      avatarUrl: null,
    },
    mainItems: [
      {
        key: "profile",
        type: "link",
        href: buildPublicPath("/profile"),
        label: "Профиль",
        icon: UserCircle,
      },
      {
        key: "settings",
        type: "link",
        href: buildAdminPath("/settings"),
        label: "Настройки",
        icon: Settings,
      },
    ],
    contextItems: [
      {
        key: "to-personal",
        type: "button",
        label: "Перейти в личный аккаунт",
        icon: User,
        variant: "accent",
        onClick: () => {
          goToPersonalAccount();
        },
      },
    ],
    logoutMode: "form",
    loggingOut: false,
    onNavigate,
  };
}
