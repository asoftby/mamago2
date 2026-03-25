import {
  Briefcase,
  ClipboardList,
  CalendarDays,
  LayoutDashboard,
  Lightbulb,
  MapPin,
  Settings,
  Shield,
  User,
  UserCircle,
} from "lucide-react";
import type { AccountMenuUser } from "@/lib/account/types";
import type { AccountMode } from "@/contexts/AccountModeContext";
import type { AccountMenuRow } from "@/components/account/types";
import type { AccountDropdownModel } from "@/components/account/AccountDropdown.types";

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

  const header = {
    email: user.email,
    initials,
    metaCaption: "Вы вошли как",
    roleLabel: null as string | null,
    avatarUrl: null as string | null,
  };

  if (mode === "personal") {
    const mainItems: AccountMenuRow[] = [
      {
        key: "profile",
        type: "link",
        href: "/me",
        label: "Профиль",
        icon: User,
      },
      {
        key: "ideas",
        type: "link",
        href: "/me/ideas",
        label: "Мои идеи",
        icon: Lightbulb,
      },
      {
        key: "plan",
        type: "link",
        href: "/me/plan",
        label: "Мой план",
        icon: CalendarDays,
      },
    ];

    const contextItems: AccountMenuRow[] | undefined = isAdminRole(user.role)
      ? [
          {
            key: "admin",
            type: "link",
            href: "/admin",
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
      sheetTitle: "Аккаунт",
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
        href: "/business/dashboard",
        label: "Дашборд",
        icon: LayoutDashboard,
      },
      {
        key: "places",
        type: "link",
        href: "/business/places",
        label: "Мои места",
        icon: MapPin,
      },
      {
        key: "commercial",
        type: "link",
        href: "/business/commercial",
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
      initials,
      roleLabel: "Администратор",
      metaCaption: null,
      avatarUrl: null,
    },
    mainItems: [
      {
        key: "profile",
        type: "link",
        href: "/profile",
        label: "Профиль",
        icon: UserCircle,
      },
      {
        key: "settings",
        type: "link",
        href: "/admin/settings",
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
