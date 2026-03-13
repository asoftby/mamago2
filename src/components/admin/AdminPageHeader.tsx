import { BackButton } from "./BackButton";

interface AdminPageHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  backHref?: string;
  actions?: React.ReactNode;
}

export function AdminPageHeader({
  title,
  subtitle,
  showBackButton = true,
  backHref = "/admin",
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {showBackButton && <BackButton href={backHref} />}
        <div>
          <h1 className="text-2xl md:text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
