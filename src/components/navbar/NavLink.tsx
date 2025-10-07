"use client";

import useMessageStore from "@/hooks/useMessageStore";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  label: string;
};

export default function NavLink({ href, label }: Props) {
  const pathname = usePathname();
  const { unreadCount } = useMessageStore((state) => ({
    unreadCount: state.unreadCount,
  }));

  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-2 px-4 py-2 text-lg font-bold uppercase transition-all duration-300 rounded-lg",
        "hover:bg-white/10 hover:scale-105",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-pink-500",
        isActive
          ? "text-yellow-200 bg-white/10 shadow-md"
          : "text-white hover:text-yellow-100"
      )}
      style={{ textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)' }}
    >
      <span>{label}</span>
      {href === "/messages" && unreadCount > 0 && (
        <Badge
          variant="destructive"
          className={cn(
            "h-5 min-w-[20px] px-1.5 text-xs font-bold",
            "animate-pulse shadow-lg"
          )}
        >
          {unreadCount}
        </Badge>
      )}
      {isActive && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-8 bg-yellow-200 rounded-full" />
      )}
    </Link>
  );
}
