import {
  Card,
  CardBody,
  CardHeader,
} from "@nextui-org/react";
import React from "react";

export default function EmptyState() {
  return (
    <div className="flex justify-center items-center mt-20">
      <Card className="p-5">
        <CardHeader className="text-3xl text-default">
          No profiles available
        </CardHeader>
        <CardBody className="text-center">
          Check back later for new matches!
        </CardBody>
      </Card>
    </div>
  );
}
