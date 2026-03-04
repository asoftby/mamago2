import { Surface } from "@/components/ui/surface";
import { H2, Body, BodyMuted } from "@/components/ui/typography";
import { LogoutButton } from "@/app/(public)/me/LogoutButton";

type MeHeaderCardProps = {
  email: string;
  displayName?: string;
};

export function MeHeaderCard({ email, displayName }: MeHeaderCardProps) {
  // Derive display name from email if not provided
  const name = displayName || email.split("@")[0];

  return (
    <Surface variant="elevated" className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          {/* Avatar placeholder */}
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-semibold text-primary">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* User info */}
          <div className="flex-1">
            <H2 className="mb-1">{name}</H2>
            <BodyMuted className="text-sm">{email}</BodyMuted>
            <BodyMuted className="text-sm mt-2">
              Вы планируете время для семьи
            </BodyMuted>
          </div>
        </div>

        {/* Logout */}
        <LogoutButton />
      </div>
    </Surface>
  );
}
