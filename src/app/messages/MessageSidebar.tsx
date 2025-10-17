"use client";

import useMessageStore from "@/hooks/useMessageStore";
import { Chip } from "@nextui-org/react";
import clsx from "clsx";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import React, { useState } from "react";
import { GoInbox } from "react-icons/go";
import { MdOutlineOutbox } from "react-icons/md";

export default function MessageSidebar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [selected, setSelected] =
    useState<string>(
      searchParams.get("container") || "inbox"
    );

  const items = [
    {
      key: "inbox",
      label: "Inbox",
      icon: GoInbox,
      chip: true,
    },
    {
      key: "outbox",
      label: "Outbox",
      icon: MdOutlineOutbox,
      chip: false,
    },
  ];

  const handleSelect = (key: string) => {
    setSelected(key);
    const params = new URLSearchParams();
    params.set("container", key);
    router.replace(`${pathname}?${params}`);
  };

  const { unreadCount } = useMessageStore(
    (state) => ({
      unreadCount: state.unreadCount,
    })
  );

  return (
    <div className="flex flex-row md:flex-col shadow-md rounded-lg cursor-pointer">
      {items.map(
        ({ key, icon: Icon, label, chip }) => (
          <div
            key={key}
            className={clsx(
              "flex flex-row items-center gap-2 p-2 md:p-3 flex-1 md:flex-none justify-center md:justify-start",
              {
                "text-default font-semibold bg-default-100":
                  selected === key,
                "text-black hover:text-default/70":
                  selected !== key,
                "rounded-l-lg md:rounded-t-lg md:rounded-l-none": key === "inbox",
                "rounded-r-lg md:rounded-t-none md:rounded-l-lg": key === "outbox",
              }
            )}
            onClick={() => handleSelect(key)}
          >
            <Icon size={20} className="md:w-6 md:h-6" />
            <div className="flex items-center gap-2 md:justify-between md:flex-grow">
              <span className="text-sm md:text-base">{label}</span>
              {chip && <Chip size="sm" className="text-xs">{unreadCount}</Chip>}
            </div>
          </div>
        )
      )}
    </div>
  );
}
