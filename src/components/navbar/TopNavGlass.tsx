'use client'

import { Button } from "@/components/ui/button";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { GiSelfLove } from "react-icons/gi";
import NavLink from "./NavLink";
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
    if (status === "authenticated" && session?.user) {
      setUserInfo({
        name: session.user.name || null,
        image: session.user.image || null,
      });
    } else if (status === "unauthenticated") {
      setUserInfo(null);
    }
  }, [session, status]);

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

          {/* Right Side - User Menu or Auth Buttons */}
          <div className="flex items-center gap-3">
            {isLoggedIn && userInfo ? (
              <UserMenu userInfo={userInfo} />
            ) : (
              <>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-gray-300/80 text-slate-700 bg-white/60 backdrop-blur-md hover:bg-white/80 hover:border-gray-400/80 shadow-sm"
                >
                  <Link href="/login">Login</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="bg-pink-500/90 hover:bg-pink-600 text-white shadow-md hover:shadow-lg"
                >
                  <Link href="/register">Register</Link>
                </Button>
              </>
            )}
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