"use client";

import { Search, User, UserCircle, Settings, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/business/notifications/NotificationBell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BusinessHeaderProps {
  userEmail?: string;
}

export function BusinessHeader({ userEmail }: BusinessHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-4 px-6">
        {/* Brand */}
        <div className="flex items-center gap-2 min-w-[200px]">
          <span className="text-lg font-semibold text-gray-900">
            mamaGo Business
          </span>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Поиск..."
              className="pl-9 h-9 bg-gray-50 border-gray-200 focus:bg-white"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Notifications */}
          <NotificationBell />

          {/* Profile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-600" />
                </div>
                {userEmail && (
                  <span className="text-sm text-gray-700 hidden md:inline">
                    {userEmail}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-white">
              <DropdownMenuItem asChild>
                <a href="/profile" className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <UserCircle className="w-5 h-5 text-gray-600" />
                  <span>Профиль</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/business/settings" className="flex items-center gap-3 px-4 py-3 cursor-pointer">
                  <Settings className="w-5 h-5 text-gray-600" />
                  <span>Настройки</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <form action="/api/auth/logout" method="POST" className="w-full">
                  <button type="submit" className="flex items-center gap-3 px-4 py-3 w-full text-left">
                    <LogOut className="w-5 h-5 text-gray-600" />
                    <span>Выйти</span>
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
