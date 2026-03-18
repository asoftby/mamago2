"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, User, Search } from "lucide-react";

export function HeaderTopChrome() {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] h-[95px] items-center">
      
      {/* LEFT ANCHOR - Logo and search icon */}
      <div className="flex items-center gap-3">
        <Link href="/minsk" className="hover:opacity-80 transition-opacity">
          <Image
            src="/favico_mamago.webp"
            alt="MamaGo"
            width={100}
            height={100}
            priority
            className="w-auto h-[39px]"
          />
        </Link>

        <Link
          href="/minsk"
          className="flex items-center justify-center w-[39px] h-[39px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
          aria-label="Глобальный поиск"
        >
          <Search className="h-5 w-5 text-gray-600" />
        </Link>
      </div>

      {/* CENTER SPACE - Reserved for compact search when needed */}
      <div className="relative h-[48px] flex items-center justify-center min-w-[400px]">
        {/* This space is used by compact presentation */}
      </div>

      {/* RIGHT ANCHOR - Profile and favorites */}
      <div className="flex items-center gap-3">
        <Link
          href="/me"
          className="flex items-center justify-center w-[39px] h-[39px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
          aria-label="Избранное"
        >
          <Heart className="h-5 w-5 text-gray-600" />
        </Link>

        <Link
          href="/profile"
          className="flex items-center justify-center w-[39px] h-[39px] bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-colors duration-200 shadow-sm"
          aria-label="Профіль"
        >
          <User className="h-5 w-5 text-gray-600" />
        </Link>
      </div>
      
    </div>
  );
}