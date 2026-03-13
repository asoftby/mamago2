import { SectionWrapper } from "../_components/SectionWrapper";
import { PatternBlock } from "../_components/PatternBlock";
import { Search, Bell, User, Menu } from "lucide-react";

export function HeaderSection() {
  return (
    <SectionWrapper
      id="header"
      title="0. Header"
      description="Global admin header with navigation and utilities"
    >
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> This is a documented pattern only. The real admin header implementation is separate.
        </p>
      </div>

      <PatternBlock
        title="Admin Header Pattern"
        description="Responsive header with brand, search, notifications, and account"
        desktop={
          <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="h-16 px-6 flex items-center justify-between">
              {/* Left: Brand */}
              <div className="flex items-center gap-4">
                <div className="font-bold text-lg text-gray-900">Admin Panel</div>
              </div>

              {/* Center: Search */}
              <div className="flex-1 max-w-md mx-8">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-full h-10 pl-10 pr-4 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Right: Utilities */}
              <div className="flex items-center gap-3">
                {/* Notifications */}
                <button className="relative p-2 hover:bg-gray-100 rounded-lg">
                  <Bell className="h-5 w-5 text-gray-600" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>

                {/* Account */}
                <button className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        }
        mobile={
          <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="h-14 px-4 flex items-center justify-between">
              {/* Left: Burger Menu */}
              <button className="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
                <Menu className="h-5 w-5 text-gray-600" />
              </button>

              {/* Center: Brand */}
              <div className="flex-1 text-center">
                <div className="font-bold text-base text-gray-900">Admin</div>
              </div>

              {/* Right: Utilities */}
              <div className="flex items-center gap-1">
                {/* Notifications */}
                <button className="relative p-2 hover:bg-gray-100 rounded-lg">
                  <Bell className="h-5 w-5 text-gray-600" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>

                {/* Account */}
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        }
        note="Desktop: Full search bar, no burger. Mobile: Burger menu opens drawer, compact brand"
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-6">
        <p className="text-sm text-blue-900 mb-2">
          <strong>Mobile Overlays:</strong> На мобильных устройствах уведомления и профильное меню открываются как bottom sheet вместо dropdown.
        </p>
        <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
          <li>Desktop: Dropdown меню (300px ширина)</li>
          <li>Mobile: Bottom sheet (70vh высота, rounded-t-2xl)</li>
          <li>Backdrop: bg-black/50 с автозакрытием</li>
        </ul>
      </div>

      <PatternBlock
        title="Mobile Header with Search Trigger"
        description="Alternative mobile header with search button instead of brand"
        desktop={
          <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="h-16 px-6 flex items-center justify-between">
              {/* Left: Brand */}
              <div className="flex items-center gap-4">
                <div className="font-bold text-lg text-gray-900">Admin Panel</div>
              </div>

              {/* Center: Search */}
              <div className="flex-1 max-w-md mx-8">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-full h-10 pl-10 pr-4 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Right: Utilities */}
              <div className="flex items-center gap-3">
                {/* Notifications */}
                <button className="relative p-2 hover:bg-gray-100 rounded-lg">
                  <Bell className="h-5 w-5 text-gray-600" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>

                {/* Account */}
                <button className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        }
        mobile={
          <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="h-14 px-4 flex items-center justify-between">
              {/* Left: Burger Menu */}
              <button className="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
                <Menu className="h-5 w-5 text-gray-600" />
              </button>

              {/* Center: Search Trigger */}
              <button className="flex-1 mx-3 h-9 px-3 bg-gray-100 rounded-lg flex items-center gap-2 text-left">
                <Search className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">Search...</span>
              </button>

              {/* Right: Utilities */}
              <div className="flex items-center gap-1">
                {/* Notifications */}
                <button className="relative p-2 hover:bg-gray-100 rounded-lg">
                  <Bell className="h-5 w-5 text-gray-600" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>

                {/* Account */}
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        }
        note="Use when search is the primary action. Mobile replaces brand with search trigger button."
      />

      {/* Navigation Behavior */}
      <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Navigation Behavior</h3>
        <div className="space-y-4 text-sm">
          <div className="flex gap-4">
            <div className="flex-1">
              <p className="font-medium text-gray-900 mb-2">Desktop</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Sidebar is always visible</li>
                <li>Burger menu is hidden</li>
                <li>Full search bar in header</li>
                <li>Brand/logo on left</li>
              </ul>
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 mb-2">Mobile</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Sidebar is hidden by default</li>
                <li>Burger menu visible on left</li>
                <li>Burger opens navigation drawer/sheet</li>
                <li>Compact brand or search trigger</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded p-4 mt-4">
            <p className="font-medium text-gray-900 mb-2">Header Height</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Desktop: <code className="text-xs bg-white px-1 py-0.5 rounded border">h-16</code> (64px)</li>
              <li>Mobile: <code className="text-xs bg-white px-1 py-0.5 rounded border">h-14</code> (56px)</li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded p-4">
            <p className="font-medium text-gray-900 mb-2">Icon Sizes</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Desktop icons: <code className="text-xs bg-white px-1 py-0.5 rounded border">h-5 w-5</code></li>
              <li>Mobile icons: <code className="text-xs bg-white px-1 py-0.5 rounded border">h-5 w-5</code></li>
              <li>Avatar desktop: <code className="text-xs bg-white px-1 py-0.5 rounded border">w-8 h-8</code></li>
              <li>Avatar mobile: <code className="text-xs bg-white px-1 py-0.5 rounded border">w-7 h-7</code></li>
            </ul>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
