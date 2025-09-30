"use client";

import { signOutUser } from "@/app/actions/authActions";
import {
  Avatar,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from "@nextui-org/react";
import { useDisconnectWallet } from "@mysten/dapp-kit";
import Link from "next/link";
import React from "react";

type Props = {
  userInfo: {
    name: string | null;
    image: string | null;
  } | null;
};

export default function UserMenu({
  userInfo,
}: Props) {
  const { mutate: disconnectWallet } = useDisconnectWallet();

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

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Avatar
          isBordered
          as="button"
          className="transition-transform"
          color="secondary"
          name={getInitials(userInfo?.name || null)}
          size="sm"
          showFallback
        />
      </DropdownTrigger>
      <DropdownMenu
        variant="flat"
        aria-label="User actions menu"
        className="bg-white"
      >
        <DropdownSection showDivider>
          <DropdownItem
            isReadOnly
            as="span"
            className="h-14 flex flex-row bg-white"
            aria-label="username"
            key="username_display"
          >
            {userInfo?.name}
          </DropdownItem>
        </DropdownSection>
        <DropdownItem
          as={Link}
          href="/members/edit"
          key="edit_profile"
          className="bg-white hover:bg-gray-100"
        >
          Edit profile
        </DropdownItem>
        <DropdownItem
          color="danger"
          onClick={handleLogout}
          key="logout"
          className="bg-white hover:bg-red-50"
        >
          Log out
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
