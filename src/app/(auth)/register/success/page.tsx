"use client";

import CardWrapper from "@/components/CardWrapper";
import { useRouter } from "next/navigation";
import { FaCheckCircle } from "react-icons/fa";

export default function RegisterSuccessPage() {
  const router = useRouter();

  return (
    <CardWrapper
      headerText="You have successfully registered"
      subHeaderText="You can now login on the home page"
      action={() => router.push("/")}
      actionLabel="Go to home"
      headerIcon={FaCheckCircle}
    />
  );
}
