"use client";

import { signOutUser } from "@/app/actions/authActions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDisconnectWallet, useCurrentAccount } from "@mysten/dapp-kit";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { User, Edit, LogOut, Wallet, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/hooks/useAuthStore";

type Props = {
  userInfo: {
    name: string | null;
    image: string | null;
    avatarUrl?: string | null;
  } | null;
};

export default function UserMenu({ userInfo }: Props) {
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const currentAccount = useCurrentAccount();
  const { data: session } = useSession();
  const { setUserInfo } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(userInfo?.avatarUrl || null);

  // Fetch user's avatar from avatar service
  useEffect(() => {
    const fetchAvatar = async () => {
      if (session?.user?.id) {
        try {
          // For current user, use avatar info API to get private avatar
          const response = await fetch('/api/avatar/info');
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              // Prioritize private avatar for current user, fallback to public
              const newAvatarUrl = data.data.privateUrl || data.data.publicUrl;
              setAvatarUrl(newAvatarUrl);

              // Update store with new avatar URL
              setUserInfo({
                name: userInfo?.name || null,
                image: userInfo?.image || null,
                avatarUrl: newAvatarUrl,
              });
            }
          }
        } catch (error) {
          console.error('Failed to fetch avatar:', error);
        }
      }
    };

    // Only fetch if we don't have cached avatarUrl
    if (!avatarUrl) {
      fetchAvatar();
    }

    // Listen for avatar updates
    const handleAvatarUpdate = () => {
      fetchAvatar();
    };

    window.addEventListener('avatarUpdated', handleAvatarUpdate);

    return () => {
      window.removeEventListener('avatarUpdated', handleAvatarUpdate);
    };
  }, [session?.user?.id, avatarUrl, userInfo, setUserInfo]);

  // Debug log
  useEffect(() => {
    console.log('UserMenu - currentAccount:', currentAccount);
    console.log('UserMenu - wallet address:', currentAccount?.address);
    console.log('UserMenu - avatarUrl:', avatarUrl);
  }, [currentAccount, avatarUrl]);

  const handleLogout = async () => {
    try {
      disconnectWallet();
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    } finally {
      await signOutUser();
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleCopyAddress = async () => {
    if (currentAccount?.address) {
      await navigator.clipboard.writeText(currentAccount.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "relative rounded-full ring-2 ring-white/50 ring-offset-2 ring-offset-transparent",
            "hover:ring-white/80 transition-all duration-300 hover:scale-105",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          )}
        >
          <Avatar className="h-10 w-10">
            <AvatarImage 
              src={avatarUrl || userInfo?.image || undefined} 
              alt={userInfo?.name || "User"} 
            />
            <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-600 text-white font-semibold">
              {getInitials(userInfo?.name || null)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 shadow-xl border-border/50 backdrop-blur-sm"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{userInfo?.name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                My Account
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {currentAccount?.address && (
          <>
            <DropdownMenuItem
              onClick={handleCopyAddress}
              className="cursor-pointer group"
            >
              <Wallet className="h-4 w-4 mr-2 text-muted-foreground" />
              <div className="flex items-center justify-between flex-1 gap-2">
                <span className="text-xs font-mono text-muted-foreground">
                  {formatAddress(currentAccount.address)}
                </span>
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                )}
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link
            href="/members/edit"
            className="flex items-center gap-2 transition-colors duration-200"
          >
            <Edit className="h-4 w-4" />
            <span>Edit profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 transition-colors duration-200"
        >
          <LogOut className="h-4 w-4 mr-2" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
