import PresenceAvatar from "@/components/PresenceAvatar";
import { truncateString } from "@/lib/util";
import type { MessageDto } from "@/types";
import { Button } from "@nextui-org/react";
import React from "react";
import { AiFillDelete } from "react-icons/ai";

type Props = {
  item: MessageDto;
  columnKey: string;
  isOutbox: boolean;
  deleteMessage: (message: MessageDto) => void;
  isDeleting: boolean;
};

export default function MessageTableCell({
  item,
  columnKey,
  isOutbox,
  deleteMessage,
  isDeleting,
}: Props) {
  const cellValue =
    item[columnKey as keyof MessageDto];

  switch (columnKey) {
    case "recipientName":
    case "senderName":
      return (
        <div className="flex items-center gap-1.5 md:gap-2 cursor-pointer">
          <div className="flex-shrink-0">
            <PresenceAvatar
              userId={
                isOutbox
                  ? item.recipientId
                  : item.senderId
              }
              src={
                isOutbox
                  ? item.recipientImage
                  : item.senderImage
              }
            />
          </div>
          <span className="text-xs md:text-sm truncate">{cellValue}</span>
        </div>
      );
    case "text":
      return (
        <div className="text-xs md:text-sm">{truncateString(cellValue, 80)}</div>
      );
    case "created":
      return <span className="text-xs md:text-sm whitespace-nowrap">{cellValue}</span>;
    default:
      return (
        <Button
          isIconOnly
          variant="light"
          onClick={() => deleteMessage(item)}
          isLoading={isDeleting}
          size="sm"
          className="min-w-8 w-8 h-8 md:min-w-10 md:w-10 md:h-10"
        >
          <AiFillDelete
            size={18}
            className="text-danger md:w-6 md:h-6"
          />
        </Button>
      );
  }
}
