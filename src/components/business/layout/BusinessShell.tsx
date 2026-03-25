import type { AccountMenuUser } from "@/components/site/header/AccountMenuBody";
import { BusinessHeader } from "./BusinessHeader";
import { BusinessSidebar } from "./BusinessSidebar";

interface BusinessShellProps {
  children: React.ReactNode;
  user: AccountMenuUser;
}

export function BusinessShell({ children, user }: BusinessShellProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <BusinessHeader user={user} />

      {/* Two-column layout: Sidebar + Content */}
      <div className="flex">
        {/* Left Sidebar - 20% */}
        <BusinessSidebar />

        {/* Right Content Area - 80% */}
        <main className="flex-1 p-8">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
