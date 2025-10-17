"use client";

import type { MessageDto } from "@/types";
import {
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@nextui-org/react";
import React from "react";
import MessageTableCell from "./MessageTableCell";
import { useMessages } from "@/hooks/useMessages";

type Props = {
  initialMessages: MessageDto[];
  nextCursor?: string;
};

export default function MessageTable({
  initialMessages,
  nextCursor,
}: Props) {
  const {
    columns,
    isOutbox,
    isDeleting,
    deleteMessage,
    selectRow,
    messages,
    loadMore,
    loadingMore,
    hasMore,
  } = useMessages(initialMessages, nextCursor);

  return (
    <div className="flex flex-col h-[80vh]">
      <Card className="p-0">
        <Table
          aria-label="Table with messages"
          selectionMode="single"
          onRowAction={(key: React.Key) =>
            selectRow(key)
          }
          shadow="none"
          className="flex flex-col gap-2 md:gap-3 h-[80vh] overflow-auto"
          classNames={{
            wrapper: "p-0",
            th: "text-xs md:text-sm px-2 md:px-3 py-2 md:py-3",
            td: "text-xs md:text-sm px-2 md:px-3 py-2 md:py-3",
          }}
        >
          <TableHeader columns={columns}>
            {(column) => (
              <TableColumn
                key={column.key}
                width={
                  column.key === "text"
                    ? "50%"
                    : undefined
                }
                className={
                  column.key === "text" ? "hidden md:table-cell" : ""
                }
              >
                {column.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody
            items={messages}
            emptyContent="No messages for this container"
          >
            {(item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
              >
                {(columnKey) => (
                  <TableCell
                    className={`${
                      !item.dateRead && !isOutbox
                        ? "font-semibold"
                        : ""
                    } ${
                      columnKey === "text" ? "hidden md:table-cell" : ""
                    }`}
                  >
                    <MessageTableCell
                      item={item}
                      columnKey={
                        columnKey as string
                      }
                      isOutbox={isOutbox}
                      deleteMessage={
                        deleteMessage
                      }
                      isDeleting={
                        isDeleting.loading &&
                        isDeleting.id === item.id
                      }
                    />
                  </TableCell>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="sticky bottom-0 pb-2 md:pb-3 px-2 md:px-3 text-center md:text-right bg-background">
          <Button
            color="default"
            isLoading={loadingMore}
            isDisabled={!hasMore}
            onClick={loadMore}
            size="sm"
            className="md:size-md"
          >
            {hasMore
              ? "Load more"
              : "No more messages"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
