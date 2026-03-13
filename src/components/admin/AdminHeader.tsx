"use client";

import { useState } from "react";
import { Search, User, UserCircle, Settings, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { AdminNotificationsDropdown } from "./notifications/AdminNotificationsDropdown";
import { AdminSidebar } from "./AdminSidebar";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface AdminHeaderProps {
  userEmail?: string;
}

export function AdminHeader({ userEmail }: AdminHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 1023px)");

  const profileIcon = (
    <>
      <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-blue-100 flex items-center justify-center">
        <User className="w-4 h-4 text-blue-700" />
      </div>
      {userEmail && (
        <span className="text-sm text-gray-700 hidden lg:inline">
          {userEmail}
        </span>
      )}
    </>
  );

  const profileMenuContent = (
    <div className="flex flex-col">
      {/* User Info */}
      {userEmail && (
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-6 h-6 text-blue-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{userEmail}</p>
              <p className="text-xs text-gray-500">Администратор</p>
            </div>
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="py-2">
        <a 
          href="/account" 
          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          onClick={() => setProfileSheetOpen(false)}
        >
          <UserCircle className="w-5 h-5 text-gray-600" />
          <span className="text-sm text-gray-900">Профиль</span>
        </a>
        <a 
          href="/admin/settings" 
          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          onClick={() => setProfileSheetOpen(false)}
        >
          <Settings className="w-5 h-5 text-gray-600" />
          <span className="text-sm text-gray-900">Настройки</span>
        </a>
      </div>

      {/* Logout */}
      <div className="border-t border-gray-200 p-2">
        <form action="/api/auth/logout" method="POST" className="w-full">
          <button 
            type="submit" 
            className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-gray-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 text-gray-600" />
            <span className="text-sm text-gray-900">Выйти</span>
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
        <div className="flex h-16 lg:h-16 items-center gap-4 px-4 lg:px-6">
          {/* Mobile: Burger Menu */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5 text-gray-600" />
            ) : (
              <Menu className="h-5 w-5 text-gray-600" />
            )}
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2 lg:min-w-[200px]">
            <span className="text-base lg:text-lg font-semibold text-gray-900">
              <span className="hidden sm:inline">mamaGo Admin</span>
              <span className="sm:hidden">Admin</span>
            </span>
          </div>

          {/* Desktop: Search Bar */}
          <div className="hidden lg:flex flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Поиск по админ-панели..."
                className="pl-9 h-9 bg-gray-50 border-gray-200 focus:bg-white"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1 lg:gap-3 ml-auto">
            {/* Notifications */}
            <AdminNotificationsDropdown />

            {/* Profile Menu - Desktop: Dropdown, Mobile: Sheet */}
            {isMobile ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 p-2"
                  onClick={() => setProfileSheetOpen(true)}
                >
                  {profileIcon}
                </Button>
                <Sheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen}>
                  <SheetContent side="bottom" className="h-auto p-0 rounded-t-2xl">
                    <SheetTitle className="sr-only">Профиль</SheetTitle>
                    {profileMenuContent}
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 p-2"
                  >
                    {profileIcon}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-white p-0">
                  {profileMenuContent}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Navigation Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-2xl">
          <SheetTitle className="sr-only">Навигация</SheetTitle>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">Навигация</h3>
            </div>
            
            {/* Navigation Content */}
            <div className="flex-1 overflow-y-auto">
              <AdminSidebar onNavigate={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
