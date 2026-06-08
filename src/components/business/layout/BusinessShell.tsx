import type { AccountMenuUser } from "@/lib/account/types";
import { NotificationSurfaceBootstrap } from "@/features/notifications/NotificationSurfaceBootstrap";
import { BusinessHeader } from "./BusinessHeader";
import { BusinessSidebar } from "./BusinessSidebar";
import type { BuildInfo } from "@/lib/system/buildInfo";

interface BusinessShellProps {
  children: React.ReactNode;
  user: AccountMenuUser;
  buildInfo: BuildInfo;
}

export function BusinessShell({ children, user, buildInfo }: BusinessShellProps) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f9f7f3_0%,#f5f5f4_100%)]">
      <NotificationSurfaceBootstrap surface="business" />
      <BusinessHeader user={user} buildInfo={buildInfo} />

      {/* Two-column layout: Sidebar + Content */}
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Left Sidebar - hidden on mobile */}
        <div className="hidden lg:flex lg:flex-col self-stretch">
          <BusinessSidebar />
        </div>

        {/* Right Content Area */}
        <main className="min-w-0 flex-1 w-full lg:w-auto px-5 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full min-w-0 max-w-[1380px] space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
