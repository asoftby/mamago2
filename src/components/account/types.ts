import type { LucideIcon } from "lucide-react";

/** Строка меню: ссылка или кнопка (в т.ч. акцентный контекстный переход). */
export type AccountMenuRow =
  | {
      key: string;
      type: "link";
      href: string;
      label: string;
      icon: LucideIcon;
      /** accent — как контекстные переходы (админка, бизнес и т.д.) */
      variant?: "default" | "accent";
      /** Маршрут, на котором пункт считается активным; не задан — активным не бывает. */
      activeHref?: string;
      /** Только точное совпадение (для `/me`, иначе пункт активен на всех `/me/*`). */
      activeExact?: boolean;
    }
  | {
      key: string;
      type: "button";
      label: string;
      icon: LucideIcon;
      onClick: () => void;
      /** accent — контекстный переход (личный / админ и т.д.) */
      variant?: "default" | "accent";
      activeHref?: string;
      activeExact?: boolean;
    };

export type AccountDropdownHeaderModel = {
  email: string;
  /** Human-readable name: displayName or email prefix */
  displayName: string;
  initials: string;
  avatarUrl?: string | null;
  roleLabel?: string | null;
  /** Семья: «Папа · 35–44» — тот же источник, что карточка взрослого в «Моя семья» */
  personaSubtitle?: string | null;
};
