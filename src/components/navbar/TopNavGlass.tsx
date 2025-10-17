'use client'

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { GiSelfLove } from "react-icons/gi";
import UserMenu from "./UserMenu";
import FiltersWrapper from "./FiltersWrapper";
import { useAuthStore } from "@/hooks/useAuthStore";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

type UserInfo = {
  name: string | null;
  image: string | null;
} | null;

interface Props {
  initialUserInfo: UserInfo;
  initialRole: "ADMIN" | "MEMBER" | null;
}

export default function TopNavGlass({ initialUserInfo, initialRole }: Props) {
  const { data: session, status } = useSession();
  const { isAuthenticated } = useAuthStore();
  const [userInfo, setUserInfo] = useState<UserInfo>(initialUserInfo);

  useEffect(() => {
    // Only update when status changes or user data changes
    if (status === "authenticated" && session?.user) {
      const newUserInfo = {
        name: session.user.name || null,
        image: session.user.image || null,
      };
      // Only update if actually changed
      if (JSON.stringify(newUserInfo) !== JSON.stringify(userInfo)) {
        setUserInfo(newUserInfo);
      }
    } else if (status === "unauthenticated" && userInfo !== null) {
      setUserInfo(null);
    }
  }, [session?.user?.name, session?.user?.image, status]);

  const memberLinks = [
    { href: "/members", label: "Matches" },
    { href: "/lists", label: "Lists" },
    { href: "/messages", label: "Messages" },
  ];

  const adminLinks = [
    {
      href: "/admin/moderation",
      label: "Photo Moderation",
    },
  ];

  const role = session?.user?.role || initialRole;
  const links = role === "ADMIN" ? adminLinks : memberLinks;
  const isLoggedIn = status === "authenticated" && (isAuthenticated || !!session?.user);
  const showLinks = isLoggedIn;

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b border-gray-200/60 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-6">
          {/* Brand */}
          <Link
            href="/"
            className={cn(
              "flex items-center gap-3 transition-all duration-300 hover:scale-105",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 rounded-lg"
            )}
          >
            <GiSelfLove size={36} className="text-pink-500 drop-shadow-sm" />
            <span className="text-2xl font-bold text-slate-800 tracking-tight">
              MatchMe
            </span>
          </Link>

          {/* Center Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {showLinks &&
              links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-4 py-2 text-lg font-medium tracking-wide rounded-lg transition-all duration-200",
                    "text-slate-800 hover:text-slate-900 hover:bg-black/5",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
                  )}
                >
                  {item.label}
                </Link>
              ))}
          </div>

          {/* Right Side - User Menu */}
          <div className="flex items-center gap-3">
            {isLoggedIn && userInfo && <UserMenu userInfo={userInfo} />}
          </div>
        </div>

        {/* Mobile Navigation */}
        {showLinks && (
          <div className="md:hidden border-t border-gray-200/60 bg-white/50 backdrop-blur-sm">
            <div className="container mx-auto flex items-center justify-center gap-2 px-4 py-2">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                    "text-slate-800 hover:text-slate-900 hover:bg-black/5"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
      <FiltersWrapper />
    </>
  );
}