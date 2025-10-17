import React from "react";
import dynamic from "next/dynamic";
import CardInnerWrapper from "@/components/CardInnerWrapper";

// Lazy load the client component
const EditFormClient = dynamic(() => import("./EditFormClient"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center p-8">
      <div className="animate-pulse text-gray-500">Loading profile data...</div>
    </div>
  ),
});

export default function MemberEditPage() {
  return (
    <CardInnerWrapper
      header="Edit Profile"
      body={<EditFormClient />}
    />
  );
}
